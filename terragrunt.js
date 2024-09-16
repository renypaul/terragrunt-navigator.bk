const antlr4 = require('antlr4');
const hclLexer = require('./generated-cjs/hclLexer').default;
const hclParser = require('./generated-cjs/hclParser').default;
const fs = require('fs');
const path = require('path');

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
    let currentDir = path.dirname(this.path.root);
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
    const TerragruntParser = require('./parser');

    let configStartDir = null;
    console.log('Reading file:', filePath);
    if (path.isAbsolute(filePath)) {
        configStartDir = path.dirname(filePath);
    } else if (!this.path.root) {
        throw new Error('startDir is not provided');
    } else {
        filePath = path.resolve(this.path.root, filePath);
    }

    if (tfInfo.freshStart) {
        if (tfInfo.configs === undefined) {
            tfInfo.configs = {};
        }
        if (tfInfo.ranges === undefined) {
            tfInfo.ranges = {};
        }
        tfInfo.path = {
            module: configStartDir,
            root: configStartDir,
            cwd: configStartDir,
        };
        tfInfo.terraform = {
            workspace: 'default',
        };
        tfInfo.contextBuffer = null;
        tfInfo.tfConfigCount = 0;
        tfInfo.freshStart = false;
        tfInfo.traverse = TerragruntParser.traverse;
        tfInfo.tfInfo = tfInfo;
        if (this.path === undefined) {
            this.path = tfInfo.path;
            this.terraform = tfInfo.terraform;
            this.tfConfigCount = tfInfo.tfConfigCount;
            this.contextBuffer = tfInfo.contextBuffer;
        }
    } else {
        tfInfo.path = this.path;
        tfInfo.terraform = this.terraform;
        tfInfo.tfConfigCount = this.tfConfigCount;
        tfInfo.contextBuffer = null;
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

    if (tfInfo.printTree) {
        console.log(tree.toStringTree(parser.ruleNames));
    }
    TerragruntParser.traverse(tfInfo, parser, tree, tfInfo.configs, tfInfo.ranges, null);

    return tfInfo.configs;
}

function path_relative_from_include(includeName = null, configs = this.configs) {
    let includePath = '';
    if (includeName) {
        includePath = configs?.include ? configs.include[includeName] : null;
    } else {
        includePath = configs?.include ? configs.include : null;
    }

    if (!includePath || includePath === undefined) {
        return null;
    }

    let includeDir = path.dirname(includePath);
    let relativePath = path.relative(includeDir, this.path.root);
    return relativePath;
}

const Terragrunt = {
    get_aws_account_id,
    find_in_parent_folders,
    read_terragrunt_config,
    path_relative_from_include,
};

module.exports = Terragrunt;

if (require.main === module) {
    let tfInfo = {
        freshStart: true,
        configs: {},
        ranges: {},
        printTree: false,
        tfConfigCount: 0,
    };

    try {
        let filePath = process.argv[2];
        let printTree = false;
        let printRange = false;
        if (process.argv.length > 3) {
            printTree = process.argv[3] === 'true';
            tfInfo.printTree = printTree;
        }
        if (process.argv.length > 4) {
            printRange = process.argv[4] === 'true';
        }

        if (!path.isAbsolute(filePath)) {
            filePath = path.resolve(filePath);
        }

        // If the same directory contains input.json, read the input.json file
        let baseDir = path.dirname(filePath);
        let inputJson = path.join(baseDir, 'input.json');
        if (fs.existsSync(inputJson)) {
            tfInfo.configs.variable = {};
            console.log('Reading input file: ' + inputJson);
            let input = fs.readFileSync(inputJson, 'utf8');
            let inputs = JSON.parse(input);
            tfInfo.configs.variable = Object.assign(tfInfo.configs.variable, inputs);
        }

        // Read all the .tf files in the same directory
        let files = fs.readdirSync(baseDir);
        files.forEach((file) => {
            if (file.endsWith('.tf') && file !== filePath) {
                let tfFile = path.join(baseDir, file);
                console.log('Reading config for ' + tfFile);
                tfInfo.freshStart = true;
                read_terragrunt_config(tfFile, tfInfo);
            }
        });
        tfInfo.freshStart = true;
        console.log('Reading config for ' + filePath);
        read_terragrunt_config(filePath, tfInfo);
        //tfInfo = TerragruntParser.evalExpression(`read_terragrunt_config("${filePath}", tfInfo); return tfInfo`, tfInfo);
        console.log(JSON.stringify(tfInfo.configs, null, 2));
        if (printRange) {
            console.log(JSON.stringify(tfInfo.ranges, null, 2));
        }
    } catch (e) {
        console.log('Failed to read terragrunt config: ' + e);
        console.log(tfInfo.configs);
    }
}
