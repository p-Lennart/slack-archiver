const axios = require('axios');
const fs = require('fs');
const download = require('download');

const tokens = require('./tokens.json');

function delay(t, v) {
    return new Promise(function(resolve) { 
        setTimeout(resolve.bind(null, v), t)
    });
 } // Stolen from https://stackoverflow.com/questions/39538473/using-settimeout-on-promise-chain

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true }); // Create output directory if it's not complete
        return true;
    } else {
        return false;
    }
}

function makeFilename(string) {
    string = string.replace('.', '-');
    return string;
}

function storeAsMJS(object, dir, filename) {
    if (!filename) filename = 'data'
    
    let entries = Object.entries(object);
    
    var functions = '';
    var variables = '';

    for (const i of entries) {
        functions += `export function ${i[0]}() {\n\treturn data_${i[0]};\n}\n\n`;
        variables += `var data_${i[0]} = ${JSON.stringify(i[1], null, 2)}\n\n`;
    }

    fs.writeFileSync(dir + `/${filename}.mjs`, functions + variables);
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

    downloadAttatchment: async (url_private, dir, asUser, filename) => {
        var tokenKey = 'bot';
        if (asUser) tokenKey = 'user';
        await download(url_private, dir, { headers: getSlackAuthorizationHeader(asUser) }, false, filename);
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

    // paginatedFetch: async ([method, targetField], args, asUser, cooldown, cursor, collected) => {
    //     // Set default values to undefined params
    //     if (args.limit) args.limit = 200;
    //     if (!cooldown) cooldown = 250;
    //     if (cursor) args.cursor = cursor;
    //     if (!collected) collected = [];

    //     // Perform request
    //     const res = await slackMethodRequest(method, args, asUser);
        
    //     if (!res || !res.ok || !res[targetField]) {
    //         console.log('Response problem: ', res);
    //     } else {
    //         // Merge current batch of data with storage array 
    //         collected = collected.concat(res[targetField]);

    //         if (res['has_more'] && res['response_metadata']['next_cursor']) { // Continue recursion if there's a new cursor
    //             cursor = res['response_metadata']['next_cursor'];
                
    //             console.log("Continuing; Collected so far:", collected.length);
                
    //             return delay(cooldown).then(async () => { // Commence recursion after the interval
    //                 return await module.exports.paginatedFetch([method, targetField], args, asUser, cooldown, cursor, collected);
    //             });
    //         }
    //     }

    //     return collected; // Exit recursion, return storage array
    // },

    paginatedRequest: async (method, args, asUser, cooldown, handleResponse, handlerArgs = []) => {
        var res = false;
        const returns = {};

        do {
            res = await slackMethodRequest(method, args, asUser);
            
            if (res && res.has_more) {
                args.cursor = res['response_metadata']['next_cursor'];
            }

            await delay(cooldown);
            
            const handled = await handleResponse(res, ...handlerArgs, args);

            for (const [key, value] of Object.entries(handled)) {
                if (returns[key]) {
                    returns[key] = returns[key].concat(value); 
                } else {
                    returns[key] = value;
                }
            }           
        }
        while (res && res['has_more'] && res['response_metadata']['next_cursor']);
        // return { thread_index: threadIndex, message_index: messageIndex };
        return returns;
    },


    fetchAndWriteMessages: async (args, dir, asUser, cooldown, tTS) => {
        var method = 'conversations.history';
        
        ensureDir(dir + '/messages');

        if (tTS) {
            args.ts = tTS;
            method = 'conversations.replies';
        } else {
            ensureDir(dir + '/threads');
        }
        
        async function handleResponse(res, threadTS, args) {
            // if (threadTS) console.log(res);
            
            const data = res['messages'];

            const output = {
                messages: [
                    {
                        newest: data[0].ts,
                        oldest: data[data.length - 1].ts,
                        amount: data.length,
                    }
                ],
                threads: [],
            }

            storeAsMJS({ messages: data }, `${dir}/messages`, makeFilename(output.messages[0].oldest));            

            if (!threadTS) { // If there is no thread timestamp passed, then this function is on the message level and can check for contained threads

                for (const msg of data) { // Iterate through messages, looking for threads
                        
                    var source = msg;
                    if (msg.subtype === 'thread_broadcast') {
                        source = msg.root;
                    }

                    threadTS = source['thread_ts']; 
                    
                    if (threadTS && !output.threads.find(obj => threadTS === obj.thread_ts )) { // Check each message for thread data
                        let { cursor: _, ...newArgs } = args; // Copy all args minus the cursor
                        module.exports.fetchAndWriteMessages(newArgs, `${dir}/threads/${makeFilename(threadTS)}`, asUser, cooldown, threadTS); // Recurse for the thread, save to its own folder
                        
                        output.threads.push( (({ thread_ts, reply_count, reply_users, latest_reply, is_locked }) => ({ thread_ts, reply_count, reply_users, latest_reply, is_locked }))(source) ); // Copy thread data from response to output object array
                    }

                }

            }

            return output;

        }

        const returns = await module.exports.paginatedRequest(method, args, asUser, cooldown, handleResponse, [tTS, args]);
        
        storeAsMJS({ message_index: returns.messages }, `${dir}/messages`, 'index');

        if (!tTS) {
            storeAsMJS({ thread_index: returns.threads }, `${dir}/threads`, 'index');
        }
        
        // return { thread_index: threadIndex, message_index: messageIndex };
    },

    indexFiles: async (args, asUser, cooldown) => {
        var files = [];
        var paging = [1, 1];

        while (paging[0] <= paging[1]) {
            let resp = await slackMethodRequest('files.list',  { channel: args.channel, count: args.limit, page: paging[0] }, asUser);
            
            if (resp && resp.paging && resp.paging.page && resp.paging.pages) {
                files = files.concat(resp.files);
                
                paging = [resp.paging.page + 1, resp.paging.pages];

                await delay(cooldown);
            }
        }
        
        return files;
    },

    fetchAndWriteFiles: async (files, dir, asUser, cooldown) => {
        ensureDir(`${dir}/files`);
        
        const fileIndex = {};
        const newFiles = {};

        if (fs.existsSync(`${dir}/files/index.mjs`)) {
            let fileIndexData = fs.readFileSync(dir + '/files/index.mjs');
            if (fileIndexData && fileIndexData.file_index()) {
                fileIndex = fileIndexData.file_index();
            }  
        }

        for (var i = 0; i < files.length; i++) {
            let url = files[i]['url_private']; // File url, if any
            let id = files[i]['id'];
            
            if (url && id && !fileIndex[id] && !newFiles[id]) {
                try {
                    let filename = url.split('/').slice(-1).join(''); // Get filename from url
                    let fileFolder = `${dir}/files/${id}`; // Folder to write path to
                    
                    ensureDir(fileFolder);
                    module.exports.downloadAttatchment(url, fileFolder, asUser, filename);
                    
                    files[i].filename = filename;

                    newFiles[id] = filename;

                    storeAsMJS({ data: files[i] }, fileFolder, `${makeFilename(filename)}_data`);

                    await delay(cooldown);
                } catch(error) {
                    console.log(error);
                }
            }
        }

        Object.assign(fileIndex, newFiles);
        storeAsMJS({ file_index: fileIndex }, `${dir}/files`, 'index');

        return newFiles;
    },

    // getThreadsFromMessages: async (messages, args, asUser, cooldown) => {
    //     if (!cooldown) cooldown = 100;
    //     const threads = {};
    //     for (var i = 0; i < messages.length; i++) {
    //         const threadRef = messages[i]['thread_ts'];
    //         if (threadRef && !threads[threadRef]) { // Check each message for thread data
    //             const thread = await module.exports.paginatedFetch(['conversations.replies', 'messages'], { channel: args.channel, ts: threadRef, limit: args.limit, pretty: 1 }, asUser); // Recursively gather the messages of the linked thread
    //             threads[threadRef] = thread;
    //             await delay(cooldown);
    //         }
    //     }
    //     return threads;
    // },

    generateConversationArchive: async (conversationID, asUser, dir, withAttatchments) => {
        const cooldowns = { messages: 250, fileIndex: 100, fileDownload: 150 }
        
        const allUsers = (await module.exports.getUsers(asUser)).members;
        
        const args = { channel: conversationID, limit: 200, pretty: 1 };
        
        const memberIDs = (await slackMethodRequest('conversations.members', args, asUser)).members; // Get channel members
        const info = (await module.exports.getConversationInfo(args.channel, asUser)).channel; // Get channel info
        
        writeToDir = dir + `/${labelChannel(info)}/${info.id}`; // Setup output directory
        ensureDir(writeToDir);
        
        await module.exports.fetchAndWriteMessages(args, writeToDir, asUser, cooldowns.messages);
        
        // Collect all relevant users
        const members = [];
        for (const id of memberIDs) {
            members.push(allUsers.find(user => user.id === id));
        }

        // Assemble data to output
        const output = { info: info, members: members};

        storeAsMJS(output, writeToDir);

        output.writtenDirectory = writeToDir;

        if (withAttatchments) {
            // Attatchment archiving
            console.log('Starting attatchments');
            
            const files = await module.exports.indexFiles(args, asUser, cooldowns.fileIndex);
            const channelFileIndex = await module.exports.fetchAndWriteFiles(files, dir, asUser, cooldowns.fileDownload);

            storeAsMJS({ files: channelFileIndex }, writeToDir, 'files');
        }

        return output;
    },
    
}