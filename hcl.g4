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
ARROW: '=>';
ASSIGN: '=';
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

exprTerm
    : literals
    | collectionValue
    | templateExpr
    | variableExpr
    | functionCall
    | forExpr
    | exprTerm index
//    | exprTerm getAttr
//    | exprTerm splat
    | LPAREN expression RPAREN
    ;

literals
    : basicLiterals
    | stringLiterals
    ;

basicLiterals
    : NUMBER
    | boolean_
    | NULL
    ;

stringLiterals
    : getAttrIdent
    | interpolatedString
    | STRING_LITERAL
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

index
    : LBRACK expression RBRACK
    ;

getAttrIdent
    : KNOWN_GETATTR
    | GENERIC_GETATTR
    ;

interpolatedString
    : INTERPOLATED_STRING
    ;

operation
    : unaryOp
    | binaryOp
    ;

unaryOp
    :  unaryOperator (exprTerm|operation)
    ;

binaryOp
    : exprTerm binaryOperator (exprTerm|operation)
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

// TODO: Add support for nested conditional
conditional
    :  (exprTerm | operation) QUESTION expression COLON expression
    ;

templateExpr
    : DOLLAR_LCURL expression RCURL
    ;

variableExpr
    : IDENTIFIER
    ;

functionCall
    : IDENTIFIER LPAREN functionArgs RPAREN
    ;

functionArgs
    : (expression (COMMA expression)* (COMMA | ELLIPSIS)?)?
    ;

forExpr
    : forTupleExpr
    | forObjectExpr
    ;

forObjectExpr
    : LCURL forIntro expression ARROW expression forCond? RCURL
    ;

forTupleExpr
    : LBRACK forIntro expression forCond? RBRACK
    ;

forIntro
    : 'for' IDENTIFIER (COMMA IDENTIFIER)? 'in' expression ':'
    ;

forCond
    : 'if' expression
    ;

KNOWN_GETATTR
    : ('local'|'var'|'dependency'|'module') (DOT IDENTIFIER)+
    ;

GENERIC_GETATTR
    : IDENTIFIER (DOT IDENTIFIER)+
    ;

IDENTIFIER
    : [a-zA-Z_][a-zA-Z_0-9-]*
    ;

NUMBER
    : DECIMAL+ (DOT DECIMAL+)? (EXPMARK DECIMAL+)?
    ;

INTERPOLATED_STRING
    : (QUOTE ~[\r\n]*? (DOLLAR_LCURL ~[\r\n]*? RCURL) QUOTE)
    ;

STRING_LITERAL
    : QUOTE (ESCAPED_CHAR|.)*? QUOTE
    ;

fragment DECIMAL
    : [0-9]
    ;

fragment EXPMARK
    : [eE] [+-]?
    ;

fragment ESCAPED_CHAR
    : '\\' [btnfr"\\]
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
