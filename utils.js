module.exports = {
    log: (stage, message) => {
        console.log(stage.toString().padEnd(19) + '| ' + message);
    },
    
    delay: (t, v) => {
        return new Promise(function(resolve) { 
            setTimeout(resolve.bind(null, v), t)
        });
     }, // Stolen from https://stackoverflow.com/questions/39538473/using-settimeout-on-promise-chain
    
    labelChannel: (channelInfo) => {
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
}