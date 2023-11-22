const fs = require('fs');
const { generateConversationArchive } = require('./apiTools');

const apiTools = require('./apiTools');

// function analyzer(messages) {
//     const results = [];
    
//     var first = 0;
//     var latest = 0;
//     var count = 0;
    
//     for (i = messages.length - 1; i >= 0; i--) {
//         let t = messages[i].ts;
//         console.log(t - latest);
//         if (t && t - latest > 600.0) {
//             results.push({ start: first, end: latest, amount: count, period: latest - first });
        
//             count = 0;
//             first = t;
//             latest = t;
//         } else {
//             latest = t;
//         }
//         count++;
//         //if (i < messages.length - 0) break;
//     }

//     results.sort((a, b) => b.period - a.period);
//     console.log(results);
// }

async function testFunction() {
    const channels = [];

    const channelData = await apiTools.getAccessableChannels(true);
    for (let chan of channelData) {
        channels.push(chan.id);
    }

    const skippedChannels = [];
    // [
    //     '<CHANNEL_ID>', 'C05AKQ2HR5L', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', 'C05ASA8D45R', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', 'C05B537U7G9',
    //     'C05B539MDGR', '<CHANNEL_ID>', 'C05BG59033J',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', 'C05D9TZJ9FA',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>', '<CHANNEL_ID>', '<CHANNEL_ID>',
    //     '<CHANNEL_ID>'
    // ]


    console.log(channels);

    for (let id of channels) {
        console.log('ONTO ', id);
        try {
            await apiTools.generateConversationArchive(id, './archives', true);
        } catch {
            console.log('SKIP ', id)
            skippedChannels.push(id);
        }
    }
   
    console.log(skippedChannels);

    // apiTools.getUsers(true);


    // console.log(await apiTools.getUserChannel('<USER_ID>', true));
    // apiTools.getChannelMessages('<CHANNEL_ID>', true);
    // apiTools.getChannelMessages('<CHANNEL_ID>');

    // apiTools.fetchAndWriteMessages('<CHANNEL_ID>', './archives/channel/<CHANNEL_ID>', true);


    // for (let id of channels) {
    //     console.log('ONTO ', id);
    //     await apiTools.generateConversationArchive(id, './archives', true);
    // }
   
    // analyzer(messages);
    // apiTools.downloadAttatchment('https://files.slack.com/files-pri/.../sample.png', './', true);
}

// './archives'
testFunction();