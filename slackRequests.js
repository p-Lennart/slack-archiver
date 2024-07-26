const axios = require('axios');

async function request(url, options) {
    options.method = 'get';
    try {
        const response = await axios.get(url, options);
        return response.data;
    } catch (error) {
        return console.log(error);
    }
}

module.exports = {
    getSlackAuthorizationHeader: (asUser) => {
        var tokenKey = 'bot';
        if (asUser) tokenKey = 'user';
        return { Authorization: `Bearer ${tokens[tokenKey]}` };
    },
    
    slackMethodRequest: async (method, args, asUser) => {
        return await request('https://www.slack.com/api/' + method, { params: args, headers: getSlackAuthorizationHeader(asUser) });
    }

}