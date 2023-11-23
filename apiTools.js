const axios = require('axios');
const fs = require('fs');
const download = require('download');

const tokens = require('./tokens.json');

function log(stage, message) {
    console.log(stage.toString().padEnd(19) + '| ' + message);
}

const delay = (delayInms) => {
    return new Promise(resolve => setTimeout(resolve, delayInms));
} // Stolen from https://stackoverflow.com/questions/17883692/how-to-set-time-delay-in-javascript
// Previously stolen from https://stackoverflow.com/questions/39538473/using-settimeout-on-promise-chain

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true }); // Create output directory if it's not complete
        return true;
    } else {
        return false;
    }
}

function makeFilename(string, removeLast) {
    string = string.split('.');
    if (removeLast) string = string.slice(0, -1);
    return string.join('-');
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

function readStoredMJS(fileData) {
    let output = {};

    let currentItem = false;
    let currentData = '';

    for (const line of fileData.split('\n')) {
        if (line.startsWith('var data_')) {
            if (currentItem) {
                output[currentItem] = JSON.parse(currentData);
            }
            currentData = line.slice(-1);
            currentItem = line.slice(9, -4);
        } else if (currentItem) {
            currentData += line;
        }
    }
    output[currentItem] = JSON.parse(currentData);

    return output;
}

async function request(url, options) {
    options.method = 'get';
    // try {
        const response = await axios.get(url, options);
        return response.data;
    // } catch (error) {
        // return console.log(error);
    // }
}

function getSlackAuthorizationHeader(asUser) {
    var tokenKey = 'bot';
    if (asUser) tokenKey = 'user';
    return { Authorization: `Bearer ${tokens[tokenKey]}` };
}

async function slackMethodRequest(method, args, asUser) {
    return await request('https://www.slack.com/api/' + method, { params: args, headers: getSlackAuthorizationHeader(asUser) });
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

    downloadAttatchment: async (url_private, dir, filename) => {
        await download(url_private, dir, { headers: getSlackAuthorizationHeader(true) }, false, filename);
    },

    getAccessableChannels: async (asUser) => {
        const res = await slackMethodRequest('conversations.list', { types: 'public_channel,private_channel,mpim,im', pretty: 1 }, asUser); 
        return res.channels;
    },

    getUserChannel: async (memberID) => {
        const channels = await module.exports.getAccessableChannels(true);
        match = channels.find(i => i.user && i.user === memberID); 
        return match;
    },

    paginatedRequest: async (method, args, asUser, cooldown, handleResponse, handlerArgs = []) => {
        var res = false;
        const returns = {};
        let iterations = 0;

        do {
            iterations++; 
            
            try {
                res = await slackMethodRequest(method, args, asUser);
            } catch(err) {
                console.log(err, "|||||||||||||||| ERRRORRRR");
            } finally {

                if (!res || res.error) {
                    res = 'temp';
                    if (res.error) console.log('res ERR', res.error);
                    console.log('re loop, delaying for ', 5 * (2 ** iterations));
                    await delay(5000 * (2 ** iterations));
                    continue;
                }

                if (res.has_more) {
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
        }
        while (res && res['has_more'] && res['response_metadata']['next_cursor']);
        console.log('exited do while loop');
        // return { thread_index: threadIndex, message_index: messageIndex };
        return returns;
    },

    fetchAndWriteMembers: async (args, writeToDir, cooldown) => {
        var method = 'conversations.members';
        
        async function handleResponse(res) {
            await delay(cooldown);
            return { members: res['members'] };
        }

        const allMembers = await module.exports.paginatedRequest(method, args, true, cooldown, handleResponse);
        
        storeAsMJS({ members: allMembers }, writeToDir, 'members');

        return allMembers;
    },

    fetchConversationInfo: async (conversationID) => {
        const method = 'conversations.info';
        const args = { channel: conversationID, pretty: 1 };
        
        const res = await slackMethodRequest(method, args, true);
        return res.channel;
    },

    fetchAndWriteMessages: async (args, writeToDir, cooldown, tTS) => {
        var method = 'conversations.history';
        var mode = 'messages';
        
        ensureDir(writeToDir + '/messages');
        
        if (tTS) {
            args.ts = tTS;
            method = 'conversations.replies';
            mode = 'threads';
        } else {
            ensureDir(writeToDir + '/threads');
        }
        
        async function handleResponse(res, threadTS, args) {
            const data = res['messages'];
            if (!data) console.log(res, "||||| FAILED");

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

            log('Fetch Messages', `Mode: ${mode}, ${data.length} Starting from ${data[0].ts}`);

            storeAsMJS({ messages: data }, `${writeToDir}/messages`, makeFilename(output.messages[0].oldest));            

            if (!threadTS) { // If there is no thread timestamp passed, then this function is on the message level and can check for contained threads

                for (const msg of data) { // Iterate through messages, looking for threads
                        
                    var source = msg;
                    if (msg.subtype === 'thread_broadcast') {
                        source = msg.root;
                    }

                    threadTS = source['thread_ts']; 
                    
                    if (threadTS && !output.threads.find(obj => threadTS === obj.thread_ts )) { // Check each message for thread data
                        let { cursor: _, ...newArgs } = args; // Copy all args minus the cursor
                        module.exports.fetchAndWriteMessages(newArgs, `${writeToDir}/threads/${makeFilename(threadTS)}`, cooldown, threadTS); // Recurse for the thread, save to its own folder
                        await delay(cooldown / 2);
                        output.threads.push( (({ thread_ts, reply_count, reply_users, latest_reply, is_locked }) => ({ thread_ts, reply_count, reply_users, latest_reply, is_locked }))(source) ); // Copy thread data from response to output object array
                    }

                }

            }

            await delay(cooldown);
            return output;

        }

        const returns = await module.exports.paginatedRequest(method, args, true, cooldown, handleResponse, [tTS, args]);
        
        storeAsMJS({ message_index: returns.messages }, `${writeToDir}/messages`, 'index');

        if (!tTS) {
            storeAsMJS({ thread_index: returns.threads }, `${writeToDir}/threads`, 'index');
        }
        
        // return { thread_index: threadIndex, message_index: messageIndex };
    },

    fetchFileData: async (args, cooldown) => {
        const method = 'files.list';
        args = { channel: args.channel, count: args.limit };

        var files = [];
        var paging = [1, 1];

        let iterations = 0;

        while (paging[0] <= paging[1]) {
            iterations++;
            try {
                args.page = paging[0];
                let resp = await slackMethodRequest(method, args, true);
                
                if (resp && resp.paging && resp.paging.page && resp.paging.pages) {
                    files = files.concat(resp.files);
                    
                    paging = [resp.paging.page + 1, resp.paging.pages];
                    
                    console.log(`Fetch File Data | Page ${resp.paging.page}/${resp.paging.pages}`);
                    await delay(cooldown);
                }

            } catch(err) {
                console.log(err, "||||FILE ERR, WAIT ", cooldown * (2 ** iterations));
                await delay(cooldown * (2 ** iterations));
            }
        }
        
        return files;
    },

    fetchAndWriteFiles: async (files, dir, cooldown) => {
        ensureDir(`${dir}/files`);
        
        var fileIndex = {};
        const newFiles = {};

        if (fs.existsSync(`${dir}/files/index.mjs`)) {
            let fileIndexData = fs.readFileSync(`${dir}/files/index.mjs`, 'utf-8');
            if (fileIndexData) {                
                let fileIndexContainer = readStoredMJS(fileIndexData);
                
                if (fileIndexContainer.file_index) {

                    fileIndex = fileIndexContainer.file_index;
                    log('Write Files', `Existing file index found, ${Object.entries(fileIndex).length} items`);
                } 
            }
        }

        for (var i = 0; i < files.length; i++) {
            let url = files[i]['url_private']; // File url, if any
            let id = files[i]['id'];
            
            if (url && id && !fileIndex[id] && !newFiles[id]) {
                try {
                    let filename = url.split('/').slice(-1).join(''); // Get filename from url
                    let fileFolder = `${dir}/files/${id}`; // Folder to write path to
                    
                    log('Write Files', `${i + 1}/${files.length}: ${url}`);
                    
                    ensureDir(fileFolder);
                    module.exports.downloadAttatchment(url, fileFolder, filename);
                    
                    files[i].filename = filename;

                    newFiles[id] = filename;

                    storeAsMJS({ data: files[i] }, fileFolder, `${makeFilename(filename, true)}_data`);

                    await delay(cooldown);
                } catch(error) {
                    console.log(error);
                }
            } else if (url && id) {
                log('Write Files', `${i + 1}/${files.length} Duplicate Item - Skipping ${url}`)
            }
        }

        Object.assign(fileIndex, newFiles);
        storeAsMJS({ file_index: fileIndex }, `${dir}/files`, 'index');

        log('Write Files', `Index and ${Object.entries(newFiles).length} new files written to ${dir}/files`);

        return newFiles;
    },

    generateConversationArchive: async (conversationID, dir, withAttatchments) => {
        const cooldowns = { members: 500, messages: 700, fileIndex: 100, fileDownload: 150 }
        
        const args = { channel: conversationID, limit: 200, pretty: 1 };
        
        const info = await module.exports.fetchConversationInfo(conversationID); // Get channel info
        const writeToDir = dir + `/${labelChannel(info)}/${info.id}`; // Setup output directory
        
        ensureDir(writeToDir);
        storeAsMJS({ info: info }, writeToDir, 'info');

        await module.exports.fetchAndWriteMembers(args, writeToDir, cooldowns.members); // Get channel members
        await module.exports.fetchAndWriteMessages(args, writeToDir, cooldowns.messages);

        if (withAttatchments) {
            // Attatchment archiving
            const files = await module.exports.fetchFileData(args, cooldowns.fileIndex);
            const channelFileIndex = await module.exports.fetchAndWriteFiles(files, dir, cooldowns.fileDownload);

            storeAsMJS({ files: channelFileIndex }, writeToDir, 'files');
        }

        return writeToDir;
    },
    
}