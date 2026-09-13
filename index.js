const fs = require('fs');
const apiTools = require('./apiTools');

function analyzer(messages) {
    const results = [];
    
    var first = 0;
    var latest = 0;
    var count = 0;
    
    for (let i = messages.length - 1; i >= 0; i--) {
        let t = messages[i].ts;
        console.log(t - latest);
        if (t && t - latest > 600.0) {
            results.push({ start: first, end: latest, amount: count, period: latest - first });
        
            count = 0;
            first = t;
            latest = t;
        } else {
            latest = t;
        }
        count++;
    }

    results.sort((a, b) => b.period - a.period);
    console.log(results);
}

/**
 * Example runner demonstrating the core apiTools workflows.
 * Replace placeholder variables with your actual Slack channel/user IDs.
 */
async function run() {
    const channelId = '<CHANNEL_ID>';      // e.g. 'C0123456789' (channel) or 'D0123456789' (DM)
    const userId    = '<USER_ID>';         // e.g. 'U0123456789'
    const outputDir = './archives';
    const sampleFileUrl = 'https://files.slack.com/files-pri/.../image.png';

    // 1. Channel Discovery: List accessible public channels, private channels, and DMs
    // const channels = await apiTools.getAccessableChannels(true);
    // console.log('Accessible channels:', channels);

    // 2. DM Channel Lookup: Find the DM conversation channel for a specific user ID
    // const userChannel = await apiTools.getUserChannel(userId);
    // console.log('User DM channel:', userChannel);

    // 3. Conversation Details: Fetch channel metadata, topic, and purpose
    // const channelInfo = await apiTools.fetchConversationInfo(channelId);
    // console.log('Channel Info:', channelInfo);

    // 4. Granular Extraction: Fetch and store members and message history separately
    // await apiTools.fetchAndWriteMembers({ channel: channelId, limit: 200 }, `${outputDir}/manual`, 100);
    // await apiTools.fetchAndWriteMessages({ channel: channelId, limit: 200 }, `${outputDir}/manual`, 250);

    // 5. Full Archive Pipeline: Comprehensive archive of info, members, messages, threads, and attachments
    await apiTools.generateConversationArchive(channelId, outputDir, true);

    // 6. Direct File Download: Download a single private file attachment using Bearer auth
    // await apiTools.downloadAttatchment(sampleFileUrl, outputDir, 'downloaded_image.png');

    // 7. Message Analytics: Analyze conversation activity bursts and inactivity periods (> 10 mins)
    // analyzer(messages);
}

run();