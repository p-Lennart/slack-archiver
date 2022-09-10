function getURLParameters() {
    const result = {};
    
    const paramStr = window.location.search.substring(1);
    const pairs = paramStr.split('&');
    
    if (paramStr.length > 0) {
        for (const i of pairs) {
            let seperated = i.split('=');
            result[seperated[0]] = seperated[1];
        }        
    }

    return result;
}