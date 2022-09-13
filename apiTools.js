const axios = require('axios');
const fs = require('fs');
const download = require('download');

const tokens = require('./tokens.json');

function delay(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
 } // Stolen from https://stackoverflow.com/questions/39538473/using-settimeout-on-promise-chain


function storeAsMJS(object, dir) {
    let entries = Object.entries(object);
    
    var functions = '';
    var variables = '';

    for (const i of entries) {
        functions += `export function ${i[0]}() {\n\treturn data_${i[0]};\n}\n\n`;
        variables += `var data_${i[0]} = ${JSON.stringify(i[1], null, 2)}\n\n`;
    }

    fs.writeFileSync(dir + '/data.mjs', functions + variables);
}


async function req(url, options) {
    options.method = 'get';
    try {
        const response = await axios.get(url, options);
        return response.data;
    } catch (error) {
        return console.log(error);
    }
}

function getSlackAuthorizationHeader(asUser) {
    var tokenKey = 'bot';
    if (asUser) tokenKey = 'user';
    return { Authorization: `Bearer ${tokens[tokenKey]}` };
}

async function slackMethodRequest(method, args, asUser) {
    return await req('https://www.slack.com/api/' + method, { params: args, headers: getSlackAuthorizationHeader(asUser) });
}

// async function dl(url, path, headers) {
//     console.log(headers);
//     const file = fs.createWriteStream(path);
//     const response = await axios.get(url, {
//         headers: headers, 
//         responseType: 'stream'
//     });
//     console.log(response);

//     const stream = response.data;
//     stream.pipe(file);

//     // stream.on('data', data => {
//     //     console.log(data);
//     // });

//     // stream.on('end', () => {
//     //     console.log("stream done");
//     // });

//     file.on("finish", () => {
//         file.close();
//         console.log("Download Completed");
//     });
// }

function labelChannel(channelInfo) {
    if (channelInfo['is_channel']) { // Determine channel type
        if (channelInfo['is_private']) {
            return 'channel-private';
        } else {
            return 'channel';
        }
    } else if (channelInfo['is_im']) {
        return 'dm';
    }
    return 'unknown';
}

module.exports = {

    downloadAttatchment: async (url_private, dir, asUser) => {
        var tokenKey = 'bot';
        if (asUser) tokenKey = 'user';
        await download(url_private, dir, { headers: getSlackAuthorizationHeader(asUser) });
        // await dl(url_private, dir, getSlackAuthorizationHeader(asUser));
    },

    getAccessableChannels: async (asUser) => {
        const res = await slackMethodRequest('conversations.list', { types: 'public_channel,private_channel,im', pretty: 1 }, asUser); 
        return res.channels;
    },

    getUsers: async (asUser) => {
        const res = await slackMethodRequest('users.list', { pretty: 1 }, asUser); 
        return res;
    },

    getConversationInfo: async (conversationID, asUser) => {
        const res = await slackMethodRequest('conversations.info', { channel: conversationID, pretty: 1 }, asUser); 
        return res;
    },

    getUserChannel: async (memberID, asUser) => {
        const channels = await module.exports.getAccessableChannels(asUser);
        match = channels.find(i => i.user && i.user === memberID); 
        return match;
    },

    paginatedFetch: async ([method, targetField], args, asUser, cooldown, cursor, collected) => {
        // Set default values to undefined params
        if (args.limit) args.limit = 200;
        if (!cooldown) cooldown = 250;
        if (cursor) args.cursor = cursor;
        if (!collected) collected = [];

        // Perform request
        const res = await slackMethodRequest(method, args, asUser);
        
        if (!res || !res.ok || !res[targetField]) {
            console.log('Response problem: ', res);
        } else {
            // Merge current batch of data with storage array 
            collected = collected.concat(res[targetField]);

            if (res['has_more'] && res['response_metadata']['next_cursor']) { // Continue recursion if there's a new cursor
                cursor = res['response_metadata']['next_cursor'];
                
                console.log("Continuing; Collected so far:", collected.length);
                
                return delay(cooldown).then(async () => { // Commence recursion after the interval
                    return await module.exports.paginatedFetch([method, targetField], args, asUser, cooldown, cursor, collected);
                });
            }
        }

        return collected; // Exit recursion, return storage array
    },

    getThreadsFromMessages: async (messages, args, asUser, cooldown) => {
        if (!cooldown) cooldown = 100;
        const threads = {};
        for (var i = 0; i < messages.length; i++) {
            const threadRef = messages[i]['thread_ts'];
            if (threadRef && !threads[threadRef]) { // Check each message for thread data
                const thread = await module.exports.paginatedFetch(['conversations.replies', 'messages'], { channel: args.channel, ts: threadRef, limit: args.limit, pretty: 1 }, asUser); // Recursively gather the messages of the linked thread
                threads[threadRef] = thread;
                await delay(cooldown);
            }
        }
        return threads;
    },

    generateConversationArchive: async (conversationID, asUser, writeToDir, withAttatchments) => {
        var dir = writeToDir;
        
        const cooldown = [100, 100, 100, 100];
        
        const allUsers = (await module.exports.getUsers(asUser)).members;
        
        const args = { channel: conversationID, limit: 200, pretty: 1 }; 
        
        const memberIDs = (await slackMethodRequest('conversations.members', args, asUser)).members;
        const info = (await module.exports.getConversationInfo(args.channel, asUser)).channel; // Get channel info
        const messages = await module.exports.paginatedFetch(['conversations.history', 'messages'], args, asUser, cooldown[0]); // Fetch all channel messages (without threads, which are seperate)
        const threads = await module.exports.getThreadsFromMessages(messages, args, asUser, cooldown[1]); // Get threads from fetched message
        
        // Collect all relevant users
        const members = [];
        for (const id of memberIDs) {
            members.push(allUsers.find(user => user.id === id));
        }

        // Assemble data to output
        const output = { info: info, members: members, messages: messages, threads: threads };

        if (!dir) return output;

        dir += `/${labelChannel(info)}/${info.id}`; // Setup output directory
        
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true }); // Create output directory if it's not complete
        }

        storeAsMJS(output, dir);
        output.writtenDirectory = dir;

        if (!withAttatchments) return output;
        
        // Attatchment archiving
        console.log('Starting attatchments');
        var files = [];
        var paging = [1, 1];

        while (paging[0] <= paging[1]) {
            let resp = await slackMethodRequest('files.list',  { channel: args.channel, count: args.limit, page: paging[0] }, asUser);
            if (resp && resp.paging && resp.paging.page && resp.paging.pages) {
                files = files.concat(resp.files);
                paging = [resp.paging.page + 1, resp.paging.pages];
                await delay(cooldown[2]);
            }
        }
        
        for (var i = 0; i < files.length; i++) {
            if (files[i].id && files[i]['url_private']) {
                module.exports.downloadAttatchment(files[i]['url_private'], `${dir}/files/${files[i]['id']}/`, asUser);
                await delay(cooldown[3]);
            }
        }

        return output;
    },
    
}