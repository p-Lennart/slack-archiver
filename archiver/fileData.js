const download = require('download');

async function downloadAttatchment (url_private, dir, filename) {
    await download(url_private, dir, { headers: getSlackAuthorizationHeader(true) }, false, filename);
}

module.exports = {
    fetchFileData: async (args, cooldown) => {
        const method = 'files.list';
        args = { channel: args.channel, count: args.limit };
    
    
        var files = [];
        var paging = [1, 1];
    
        while (paging[0] <= paging[1]) {
            args.page = paging[0];
            let resp = await slackMethodRequest(method, args, true);
            
            if (resp && resp.paging && resp.paging.page && resp.paging.pages) {
                files = files.concat(resp.files);
                
                paging = [resp.paging.page + 1, resp.paging.pages];
                
                console.log(`Fetch File Data | Page ${resp.paging.page}/${resp.paging.pages}`);
                await delay(cooldown);
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
}
