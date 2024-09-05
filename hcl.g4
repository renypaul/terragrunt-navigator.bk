grammar hcl;

// Avoid keywords of language in token, label or rule names
QUOTE: '"';
PLUS: '+';
MINUS: '-';
STAR: '*';
SLASH: '/';
PERCENT: '%';
NOT: '!';
AND: '&&';
OR: '||';
EQUAL: '==';
NOT_EQUAL: '!=';
LESS_THAN: '<';
GREATER_THAN: '>';
LESS_EQUAL: '<=';
GREATER_EQUAL: '>=';
QUESTION: '?';
COLON: ':';
ASSIGN: '=';
ARROW: '=>';
LCURL: '{';
RCURL: '}';
LBRACK: '[';
RBRACK: ']';
LPAREN: '(';
RPAREN: ')';
DOT: '.';
COMMA: ',';
ELLIPSIS: '...';
DOLLAR_LCURL: '${';
PERCENT_LCURL: '%{';
TRUE: 'true';
FALSE: 'false';
NULL: 'null';


configFile
    : body EOF
    ;

body
    : NEWLINE* (argument | block | oneLineBlock)*
    ;

block
    : IDENTIFIER (IDENTIFIER | STRING_LITERAL)* LCURL NEWLINE? body RCURL NEWLINE?
    ;

oneLineBlock
    : IDENTIFIER (IDENTIFIER | STRING_LITERAL)* LCURL argument? RCURL NEWLINE?
    ;

argument
    : IDENTIFIER ASSIGN expression NEWLINE?
    ;

expression
    : exprTerm
    | operation
    | conditional
    ;

// TODO: Add support for nested conditional
conditional
    :  (exprTerm | operation) QUESTION expression COLON expression
    ;

exprTerm
    : literalValue
    | collectionValue
    | templateExpr
    | variableExpr
    | functionCall
    | forExpr
    | exprTerm index
//    | exprTerm getAttr
    | GETATTR_IDENT
    | exprTerm splat
    | LPAREN expression RPAREN
    ;

literalValue
    : NUMBER
    | boolean_
    | NULL
    | STRING_LITERAL
    | getAttrIdent // Workaround
    | interpolatedString
    ;

collectionValue
    : tuple_
    | object_
    ;

tuple_
    : LBRACK (expression ((COMMA | NEWLINE?) expression)* COMMA?)? RBRACK
    ;

object_
    : LCURL NEWLINE? ((objectElement ((COMMA? | NEWLINE?) objectElement)* COMMA?)?) NEWLINE? RCURL
    ;

objectElement
    : (IDENTIFIER | expression) (ASSIGN | COLON) expression
    ;

templateExpr
    : DOLLAR_LCURL expression RCURL
    ;

functionCall
    : IDENTIFIER LPAREN functionArgs RPAREN
    ;

functionArgs
    : (expression (COMMA expression)* (COMMA | ELLIPSIS)?)?
    ;

forExpr
    : 'for' IDENTIFIER 'in' expression COLON expression ('if' expression)?
    ;

index
    : LBRACK expression RBRACK
    ;

getAttr
    : DOT IDENTIFIER
    ;

splat
    : attrSplat
    | fullSplat
    ;

attrSplat
    : DOT STAR getAttr*
    ;

fullSplat
    : LBRACK STAR RBRACK (getAttr | index)*
    ;

getAttrIdent
    : GETATTR_IDENT
    ;

interpolatedString
    : INTERPOLATED_STRING
    ;

operation
    : unaryOp
    | binaryOp
    ;

binaryOp
    : exprTerm binaryOperator exprTerm
    ;

unaryOp
    :  unaryOperator exprTerm
    ;

unaryOperator
    : PLUS
    | MINUS
    | NOT
    ;

binaryOperator
    : compareOperator
    | arithmeticOperator
    | logicOperator
    ;

compareOperator
    : EQUAL
    | NOT_EQUAL
    | LESS_THAN
    | GREATER_THAN
    | LESS_EQUAL
    | GREATER_EQUAL
    ;

arithmeticOperator
    : STAR
    | SLASH
    | PERCENT
    | PLUS
    | MINUS
    ;

logicOperator
    : AND
    | OR
    ;

boolean_
    : TRUE
    | FALSE
    ;

variableExpr
    : IDENTIFIER
    ;

IDENTIFIER
    : [a-zA-Z_-][a-zA-Z_0-9-]*
    ;

GETATTR_IDENT
    : [a-zA-Z_][a-zA-Z_0-9-.]*
    ;

NUMBER
    : DECIMAL+ (DOT DECIMAL+)? (EXPMARK DECIMAL+)?
    ;

STRING_LITERAL
    : (QUOTE ~[\r\n]*? QUOTE)
    ;

INTERPOLATED_STRING
    : (QUOTE ~[\r\n]* (DOLLAR_LCURL ~[\r\n]*? RCURL) QUOTE)
    ;

fragment DECIMAL
    : [0-9]
    ;

fragment EXPMARK
    : [eE] [+-]?
    ;

WS
    : [ \t\r\n]+ -> skip
    ;

NEWLINE
    : '\r'? '\n'
    ;

COMMENT
    : ('#' ~[\r\n]* | '//' ~[\r\n]* | '/*' .*? '*/') -> channel(HIDDEN)
    ;
