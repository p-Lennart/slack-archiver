import fs from 'fs';
import path from 'path';

export function mapViewerDataDir(rootPath) {
    const rootMap = {};
    var rootEntries = [];

    try {
        rootEntries = fs.readdirSync(rootPath, { withFileTypes: true });
    } catch (err) {
        throw new Error('Unable to scan viewer directory: ' + err);
    }
    
    if (rootEntries.length != 1) {
        throw new Error('VIEWERDATA must contain a single archive directory. It is currently empty or containing multiple contents.');
    }
    
    const archive = rootEntries[0];
    const archiveName = archive.name;

    if (!archive.isDirectory() || archive.isFile()) {
        throw new Error('VIEWERDATA must contain a single archive directory. It currently contains a file.');
    }

    if (!archiveName.includes(" Slack export ")) {
        throw new Error('The single archive directory VIEWERDATA contains must match Slack archive naming convention.');
    }

    const archivePath = path.join(rootPath, archiveName);
    rootMap[archiveName] = mapArchiveDir(archivePath);
    return rootMap;

}

function mapArchiveDir(archivePath) {
    const archiveMap = {}
    var archiveEntries = []

    try {
        archiveEntries = fs.readdirSync(archivePath, { withFileTypes: true });
    } catch (err) {
        throw new Error('Unable to scan archive directory: ' + err);
    }
    
    for (const entry of archiveEntries) {
        const entryName = entry.name;
        const entryPath = path.join(archivePath, entry.name);

        if (entry.isFile()) {
            if (entryName.endsWith('.json')) {
                archiveMap[entryName] = 'JSON';
            } else {
                throw new Error(`Archive directory ${archivePath} must contain only folders and JSON files, but contains file '${entryName}'`);
            }
        } else if (entry.isDirectory()) {
            archiveMap[entryName] = mapChannelDir(entryPath);
        }
    }

    let archiveMapKeys = Object.keys(archiveMap);

    ['channels.json', 'users.json'].forEach(entry => {
        if (!archiveMapKeys.includes(entry)) {
            throw new Error(`Archive directory ${archivePath} is missing critial JSON file ${entry}`);
        }
    });

    return archiveMap;
}

function mapChannelDir(channelPath) {
    const channelMap = {}
    var channelEntries = []

    try {
        channelEntries = fs.readdirSync(channelPath, { withFileTypes: true });
    } catch (err) {
        throw new Error('Unable to scan channel directory: ' + err);
    }
    
    for (const entry of channelEntries) {
        const entryName = entry.name;
        
        if (entry.isDirectory() || !entry.isFile()) {
            throw new Error(`Channel directory ${channelPath} must contain only JSON files, but contains folder '${entryName}'`);
        } else if (!entryName.endsWith('.json')) {
            throw new Error(`Channel directory ${channelPath} must contain only JSON files, but contains file '${entryName}'`);
        }

        channelMap[entryName] = 'JSON';
    }

    return channelMap;
}
