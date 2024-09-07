const antlr4 = require('antlr4');
const hclLexer = require('./generated-cjs/hclLexer').default;
const hclParser = require('./generated-cjs/hclParser').default;
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let globalTfInfo = {};

function traverse(tfInfo, parser, node, configs, ranges, identInfo) {
    if (!node || !node.children || typeof node.children !== 'object') {
        return;
    }

    let ident = identInfo ? identInfo.name : null;
    for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        let ruleName = parser.ruleNames[child.ruleIndex];
        if (ruleName === undefined) {
            continue;
        } else {
            //console.debug(ruleName + " -> " + child.getText());
        }
        if (ruleName === 'block') {
            let firstChild = child.children[0];
            let blockType = firstChild.getText();
            const identInfo = {
                name: blockType,
                evalNeeded: false,
                range: {
                    __range: {
                        sl: child.start.line - 1,
                        sc: child.start.column,
                        el: child.start.line - 1,
                        ec: child.start.column + firstChild.getText().length,
                    },
                },
            };

            let block = configs;
            let rangesBlock = ranges;
            let identifierCount = 0;
            let stringLiteralCount = 0;
            for (let j = 0; j < child.children.length; j++) {
                let label = null;
                if (child.IDENTIFIER(identifierCount)) {
                    label = child.IDENTIFIER(identifierCount).getText();
                    identifierCount++;
                } else if (child.STRING_LITERAL(stringLiteralCount)) {
                    label = child.STRING_LITERAL(stringLiteralCount).getText();
                    stringLiteralCount++;
                }

                if (!label) {
                    continue;
                }

                label = label.replace(/"/g, '');
                // Avoid overwriting the block itself when block with same name is present.
                // For e.g. multiple variables section in the same file
                if (!configs.hasOwnProperty(label)) {
                    configs[label] = {};
                    ranges[label] = {};
                }

                configs = configs[label];
                ranges = ranges[label];
            }

            traverse(tfInfo, parser, child, configs, ranges, identInfo);
            ranges['__range'] = identInfo.range.__range;
            configs = block;
            ranges = rangesBlock;
        } else if (ruleName === 'argument' || ruleName === 'objectElement') {
            const firstChild = child.children[0];
            const line = firstChild.start ? firstChild.start.line : child.start.line;
            const start = firstChild.start ? firstChild.start.column : child.start.column;
            const name = firstChild.getText();
            const identInfo = {
                name: name,
                buffer: [],
                evalNeeded: false,
                range: {
                    __range: {
                        sl: line - 1,
                        sc: start,
                        el: line - 1,
                        ec: start + name.length,
                    },
                },
            };
            traverse(tfInfo, parser, child, configs, ranges, identInfo);
            ident = identInfo.name;
            configs[ident] = identInfo.evalNeeded
                ? evalExpression(configs[ident], tfInfo.configs)
                : processValue(configs[ident]);
            ranges[ident] = identInfo.range;
        } else if (ruleName === 'object_') {
            let mapConfigs = configs;
            let mapRanges = ranges;
            if (Array.isArray(configs[ident])) {
                let obj = {};
                let objRanges = {};
                traverse(tfInfo, parser, child, obj, objRanges, identInfo);
                configs[ident].push(obj);
            } else if (configs[ident]) {
                let obj = {};
                let objRanges = {};
                traverse(tfInfo, parser, child, obj, objRanges, identInfo);
                configs[ident] = obj;
                ranges[ident] = identInfo.range;
            } else {
                configs[ident] = {};
                ranges[ident] = {};
                configs = configs[ident];
                ranges = identInfo.range;
                traverse(tfInfo, parser, child, configs, ranges, identInfo);
                configs = mapConfigs;
                ranges = mapRanges;
            }
        } else if (ruleName === 'tuple_') {
            if (Array.isArray(configs[ident])) {
                let obj = [];
                let objRanges = [];
                traverse(tfInfo, parser, child, obj, objRanges, identInfo);
                configs[ident].push(obj);
            } else {
                configs[ident] = [];
                ranges[ident] = identInfo.range;
                traverse(tfInfo, parser, child, configs, ranges, identInfo);
            }
        } else if (ruleName === 'expression') {
            traverse(tfInfo, parser, child, configs, ranges, identInfo);
        } else if (ruleName === 'unaryOperator') {
            let value = child.getText();
            if (value && ident) {
                configs[ident] = configs[ident] ? configs[ident] + value : value;
            }
            traverse(tfInfo, parser, child, configs, ranges, identInfo);
            identInfo.evalNeeded = true;
        } else if (ruleName === 'binaryOperator') {
            let value = child.getText();
            if (value && ident) {
                configs[ident] = configs[ident] !== undefined ? configs[ident] + value : value;
            }
            traverse(tfInfo, parser, child, configs, ranges, identInfo);
            identInfo.evalNeeded = true;
        } else if (ruleName === 'conditional') {
            let obj = {};
            const identInfo = { name: 'conditional' };
            traverse(tfInfo, parser, child.children[0], obj, ranges, identInfo);
            let condition = obj.conditional;
            obj = {};
            traverse(tfInfo, parser, child.children[2], obj, ranges, identInfo);
            let trueValue = obj.conditional;
            obj = {};
            traverse(tfInfo, parser, child.children[4], obj, ranges, identInfo);
            let falseValue = obj.conditional;
            try {
                configs[ident] = condition ? trueValue : falseValue;
            } catch (e) {
                console.log('Error in conditional: ' + child.getText() + ' Error: ' + e);
            }
        } else if (ruleName === 'index') {
            let obj = {};
            const identInfo = { name: 'index' };
            traverse(tfInfo, parser, child, obj, ranges, identInfo);
            let index = obj.index;
            configs[ident] = configs[ident][index];
        } else if (ruleName === 'basicLiterals' || ruleName === 'stringLiterals' || ruleName === 'functionCall') {
            let value = child.getText();
            let val = value;
            let evalNeeded = false;
            if (ruleName !== 'basicLiterals') {
                evalNeeded = true;
            }

            if (value && ident) {
                //console.log(ruleName + " -> " + value + ". EvalNeeded: " + evalNeeded);
                val = evalNeeded ? evalExpression(value, tfInfo.configs) : value;
                if (Array.isArray(configs[ident])) {
                    configs[ident].push(val);
                } else {
                    if (ruleName === 'stringLiterals' && typeof val === 'string') {
                        val = '"' + val + '"';
                    }
                    val = configs[ident] ? configs[ident] + val : val;
                    configs[ident] = val;
                }
                ranges[ident] = identInfo.range;
            }
        } else if (ruleName === 'forTupleExpr') {
            try {
                let forRule = child.children[1].children.map((child) => child.getText());
                let key = forRule[1];
                let list = evalExpression(forRule[3], tfInfo.configs);
                let valueExp = child.children[2].getText().replace(key, 'configs.' + key);
                let condition = null;
                if (child.children.length > 4) {
                    condition = child.children[3].children[1].getText().replace(key, 'configs.' + key);
                }
                let result = [];

                list.forEach((item) => {
                    let configs = {};
                    configs[key] = item;
                    let conditionValue = condition != null ? evalExpression(condition, configs) : true;
                    if (conditionValue) {
                        result.push(evalExpression(valueExp, configs));
                    }
                });

                configs[ident] = result;
                ranges[ident] = identInfo.range;
            } catch (e) {
                console.log('Error in forTupleExpr: ' + e);
            }
        } else if (ruleName === 'forObjectExpr') {
            try {
                let forRule = child.children[1].children.map((child) => child.getText());
                let key = forRule[1];
                let list = evalExpression(forRule[3], tfInfo.configs);
                let keyExp = child.children[2].getText().replace(key, 'configs.' + key);
                let valueExp = child.children[4].getText().replace(key, 'configs.' + key);
                let condition = null;
                if (child.children.length > 5) {
                    condition = child.children[5].children[1].getText().replace(key, 'configs.' + key);
                }
                let result = {};

                list.forEach((item) => {
                    let configs = {};
                    configs[key] = item;
                    conditionValue = condition != null ? evalExpression(condition, configs) : true;
                    if (conditionValue) {
                        result[evalExpression(keyExp, configs)] = evalExpression(valueExp, configs);
                    }
                });

                configs[ident] = result;
                ranges[ident] = identInfo.range;
            } catch (e) {
                console.log('Error in forObjectExpr: ' + e);
            }
        } else if (child.children) {
            traverse(tfInfo, parser, child, configs, ranges, identInfo);
        }
    }
}

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
    if (typeof value === 'string' || Array.isArray(value)) {
        return value.length;
    } else if (value instanceof Map) {
        return value.size;
    } else if (typeof value === 'object' && value !== null) {
        return Object.keys(value).length;
    } else {
        console.log('Unsupported type for size function');
        return 0;
    }
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

function find_in_parent_folders(fileName = null) {
    if (fileName === null) {
        fileName = 'terragrunt.hcl';
    }
    let currentDir = path.dirname(globalTfInfo.startDir);
    while (currentDir !== '/') {
        let filePath = path.join(currentDir, fileName);
        if (fs.existsSync(filePath)) {
            return filePath;
        }
        currentDir = path.dirname(currentDir);
    }
    return null;
}

function read_terragrunt_config(filePath, tfInfo = {}) {
    let configStartDir = null;
    console.log('Reading file:', filePath);
    if (path.isAbsolute(filePath)) {
        configStartDir = path.dirname(filePath);
    } else if (!globalTfInfo.startDir) {
        throw new Error('startDir is not provided');
    } else {
        filePath = path.resolve(globalTfInfo.startDir, filePath);
    }

    if (tfInfo.freshStart) {
        tfInfo.startDir = configStartDir;
        tfInfo.tfConfigCount = 0;
        globalTfInfo = tfInfo;
        tfInfo.freshStart = false;
    } else {
        tfInfo.startDir = globalTfInfo.startDir;
        tfInfo.tfConfigCount = globalTfInfo.tfConfigCount;
        tfInfo.configs = {};
        tfInfo.ranges = {};
    }
    tfInfo.tfConfigCount++;

    const input = fs.readFileSync(filePath, 'utf8');
    const chars = new antlr4.InputStream(input);
    const lexer = new hclLexer(chars);
    const tokens = new antlr4.CommonTokenStream(lexer);
    const parser = new hclParser(tokens);
    parser.buildParseTrees = true;
    const tree = parser.configFile();

    // dump json tree
    console.log(tree.toStringTree(parser.ruleNames));
    traverse(tfInfo, parser, tree, tfInfo.configs, tfInfo.ranges, null);

    return tfInfo.configs;
}

function path_relative_from_include(includeName = null, configs = globalTfInfo.configs) {
    let includePath = '';
    if (!includeName) {
        includePath = configs && configs.include ? configs.include : null;
    } else {
        includePath = configs && configs.include ? configs.include[includeName] : null;
    }

    if (!includePath || includePath === undefined) {
        return null;
    }

    let includeDir = path.dirname(includePath);
    let relativePath = path.relative(includeDir, globalTfInfo.startDir);
    return relativePath;
}

function evalExpression(exp, configs) {
    let value = exp;

    let matches = value.match(/\$\{([^}]+)\}/g);
    if (matches) {
        for (let i = 0; i < matches.length; i++) {
            let match = matches[i];
            let key = match.substring(2, match.length - 1);
            let val = runEval(key, configs);
            value = value.replace(match, val);
        }
    } else {
        value = runEval(value, configs);
    }

    if (typeof value === 'string') {
        value = processValue(value);
    }

    return value;
}

function runEval(exp, configs) {
    let value = exp;
    try {
        let local = configs && configs.locals ? configs.locals : {};
        if (typeof exp === 'string') {
            if (exp.includes('var.')) {
                exp = exp.replace('var.', 'configs.variable.');
            }
            if (exp.includes('dependency.')) {
                exp = exp.replace(/dependency\.([^.]+)\.outputs\./g, 'configs.dependency.$1.mock_outputs.');
            }
        }
        let path = { module: globalTfInfo.startDir };
        //console.log("Evaluating expression: " + exp);
        value = eval(exp);
        // convert boolean string to boolean
        if (typeof value === 'string' && (value === 'true' || value === 'false')) {
            value = value === 'true';
        }
    } catch (e) {
        console.log('Failed to evaluate expression: ' + exp + ' Error: ' + e);
    }
    return value;
}

function processValue(value) {
    if (typeof value === 'string') {
        value = value.replace(/"/g, '');
        if (value.startsWith('./') || value.startsWith('../')) {
            value = path.resolve(globalTfInfo.startDir, value);
        }
    }
    return value;
}

const Terragrunt = {
    find_in_parent_folders: find_in_parent_folders,
    read_terragrunt_config: read_terragrunt_config,
    evalExpression: evalExpression,
};

module.exports = Terragrunt;
if (require.main === module) {
    let tfInfo = {
        freshStart: true,
        startDir: null,
        configs: {},
        ranges: {},
        tfConfigCount: 0,
    };
    try {
        let filePath = process.argv[2];
        if (!path.isAbsolute(filePath)) {
            filePath = path.resolve(filePath);
        }
        console.log('Reading config for ' + filePath);
        if (path.basename(filePath) === 'main.tf') {
            let varFile = filePath.replace('main.tf', 'variables.tf');
            if (fs.existsSync(varFile)) {
                console.log('Reading variables for main.tf ' + varFile);
                this.configs = read_terragrunt_config(varFile, tfInfo);
            }
        }
        tfInfo.freshStart = true;
        configs = read_terragrunt_config(filePath, tfInfo);
        console.log(JSON.stringify(tfInfo.configs, null, 2));
        //console.log(JSON.stringify(tfInfo.ranges, null, 2));
    } catch (e) {
        console.log('Failed to read terragrunt config: ' + e);
    }
}
