const path = require('path');
const fs = require('fs');

let filePath = process.argv[2];
if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(filePath);
}
console.log(filePath);

function tomap(map) {
    test = new Map(map);
    return test;
}

function toset(set) {
    return new Set(set);
}

function tolist(list) {
    return Array.from(list);
}

function file(filePath) {
    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(filePath);
    }
    if (!fs.existsSync(filePath)) {
        return 'FileNotFound';
    }
    return fs.readFileSync(filePath, 'utf8');
}

let input = file(filePath);
let output = eval('input');
console.log(output);
