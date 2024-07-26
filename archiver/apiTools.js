const fs = require('fs');
const tokens = require('./tokens.json');

module.exports = {
    getAccessableChannels: async (asUser) => {
        const res = await slackMethodRequest('conversations.list', { types: 'public_channel,private_channel,im', pretty: 1 }, asUser); 
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


    generateConversationArchive: async (conversationID, dir, withAttatchments) => {
        const cooldowns = { members: 100, messages: 250, fileIndex: 100, fileDownload: 150 }
        
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