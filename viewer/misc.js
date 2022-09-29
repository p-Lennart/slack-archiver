function setTitle(str) {
    document.title = `Slack | ${str}`;
}

function getDate(slackTS) {
    return new Date(parseFloat(slackTS) * 1000);
}

function getMessagesInSpan(messages, start, end) {
    const result = [];
    
    for (const i of messages) {
        if (i.ts && i.ts < (end / 1000) && i.ts >= (start / 1000)) {
            result.push(i);
        }
    }

    return result;
    
}

function getDateString(date) {
    let hours = date.getHours();
    let minutes = date.getMinutes(); 
    let seconds = date.getSeconds();
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getPrettyName(member) {
    if (member.profile && member.profile['display_name'].length > 0)
        return member.profile['display_name'];
    else 
        return member['real_name'];
}