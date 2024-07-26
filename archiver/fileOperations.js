const fs = require('fs')

module.exports = {
    ensureDir: (dir) => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true }); // Create output directory if it's not complete
            return true;
        } else {
            return false;
        }
    },

    makeFilename: (string, removeLast) => {
        string = string.split('.');
        if (removeLast) string = string.slice(0, -1);
        return string.join('-');
    },

    storeAsMJS: (object, dir, filename) => {
        if (!filename) filename = 'data'
        
        let entries = Object.entries(object);
        
        var functions = '';
        var variables = '';

        for (const i of entries) {
            functions += `export function ${i[0]}() {\n\treturn data_${i[0]};\n}\n\n`;
            variables += `var data_${i[0]} = ${JSON.stringify(i[1], null, 2)}\n\n`;
        }

        fs.writeFileSync(dir + `/${filename}.mjs`, functions + variables);
    },

    readStoredMJS: (fileData) => {
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
}
