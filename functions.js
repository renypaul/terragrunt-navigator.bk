function abs(value) {
    return Math.abs(value);
}

function can(expression) {
    try {
        eval(expression);
        return true;
    } catch (e) {
        return false;
    }
}

function ceil(value) {
    return Math.ceil(value);
}

function concat(...lists) {
    return [].concat(...lists);
}

function contains(list, value) {
    return list.includes(value);
}

function endswith(value, suffix) {
    return value.endsWith(suffix);
}

function file(filePath) {
    if (!path.isAbsolute(filePath)) {
        filePath = path.resolve(globalTfInfo.startDir, filePath);
    }
    if (!fs.existsSync(filePath)) {
        return 'FileNotFound';
    }
    return fs.readFileSync(filePath, 'utf8');
}

function filebase64sha256(filePath) {
    let content = file(filePath);
    return crypto.createHash('sha256').update(content).digest('base64');
}

function floor(value) {
    return Math.floor(value);
}

function format(formatString, ...args) {
    return formatString.replace(/%([#vbtbodxXeEfFgGsq%])/g, (match, specifier) => {
        if (specifier === '%') {
            return '%';
        }
        const value = args.shift();
        switch (specifier) {
            case 'v':
                return String(value);
            case '#v':
                return JSON.stringify(value);
            case 't':
                return Boolean(value).toString();
            case 'b':
                return parseInt(value, 10).toString(2);
            case 'd':
                return parseInt(value, 10).toString(10);
            case 'o':
                return parseInt(value, 10).toString(8);
            case 'x':
                return parseInt(value, 10).toString(16);
            case 'X':
                return parseInt(value, 10).toString(16).toUpperCase();
            case 'e':
                return Number(value).toExponential();
            case 'E':
                return Number(value).toExponential().toUpperCase();
            case 'f':
                return Number(value).toFixed();
            case 'g':
                return Number(value).toPrecision();
            case 'G':
                return Number(value).toPrecision().toUpperCase();
            case 's':
                return String(value);
            case 'q':
                return JSON.stringify(String(value));
            default:
                return match;
        }
    });
}

function join(separator, list) {
    return list.join(separator);
}

function jsonencode(value) {
    return JSON.stringify(value);
}

function jsondecode(value) {
    return JSON.parse(value);
}

function length(value) {
    return value.length;
}

function lookup(map, key, defaultValue = null) {
    return map.hasOwnProperty(key) ? map[key] : defaultValue;
}

function lower(value) {
    return value.toLowerCase();
}

function max(...values) {
    return Math.max(...values);
}

function merge(...maps) {
    return Object.assign({}, ...maps);
}

function min(...values) {
    return Math.min(...values);
}

function parseint(value, base = 10) {
    return parseInt(value, base);
}

function pow(base, exponent) {
    return Math.pow(base, exponent);
}

function range(start, end) {
    return Array.from({ length: end - start }, (_, i) => i + start);
}

function replace(value, search, replacement) {
    return value.split(search).join(replacement);
}

function reverse(list) {
    return list.slice().reverse();
}

function sha1(value) {
    return crypto.createHash('sha1').update(value).digest('hex');
}

function signum(value) {
    return Math.sign(value);
}

function sort(list) {
    return list.slice().sort();
}

function split(separator, value) {
    return value.split(separator);
}

function sqrt(value) {
    return Math.sqrt(value);
}

function startswith(value, prefix) {
    return value.startsWith(prefix);
}

function strlen(value) {
    return value.length;
}

function substr(value, start, length) {
    return value.substr(start, length);
}

function timestamp() {
    return new Date().toISOString();
}

function trimspace(value) {
    return value.trim();
}

function upper(value) {
    return value.toUpperCase();
}

function uuid() {
    return crypto.randomBytes(16).toString('hex');
}

function get_aws_account_id() {
    if (process.env.AWS_ACCOUNT_ID) {
        return process.env.AWS_ACCOUNT_ID;
    }

    return '123456789012';
}

exports.module = {
    abs,
    can,
    ceil,
    concat,
    contains,
    endswith,
    file,
    filebase64sha256,
    floor,
    format,
    join,
    jsonencode,
    jsondecode,
    length,
    lookup,
    lower,
    max,
    merge,
    min,
    parseint,
    pow,
    range,
    replace,
    reverse,
    sha1,
    signum,
    sort,
    split,
    sqrt,
    startswith,
    strlen,
    substr,
    timestamp,
    trimspace,
    upper,
    uuid,
    get_aws_account_id,
    find_in_parent_folders,
    read_terragrunt_config,
    path_relative_from_include,
};
