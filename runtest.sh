#!/bin/bash

SRC_DIR="${PWD}"
node ./parser.js tests/env/region/cluster/terragrunt.hcl | sed "s#${SRC_DIR}#TERRAGRUNT_NAVIGATOR_SRC_DIR#g" >/tmp/result.txt
diff -u tests/expected-results/1.txt /tmp/result.txt
