/// Abstract Syntax Tree for FEEL expressions.
#[derive(Debug, Clone, PartialEq)]
pub enum Expr {
    // Literals
    Null,
    Bool(bool),
    Integer(i64),
    Float(f64),
    Str(String),
    // Variable reference
    Name(String),
    // Arithmetic
    Add(Box<Expr>, Box<Expr>),
    Sub(Box<Expr>, Box<Expr>),
    Mul(Box<Expr>, Box<Expr>),
    Div(Box<Expr>, Box<Expr>),
    Neg(Box<Expr>),
    // Comparison
    Eq(Box<Expr>, Box<Expr>),
    Ne(Box<Expr>, Box<Expr>),
    Lt(Box<Expr>, Box<Expr>),
    Le(Box<Expr>, Box<Expr>),
    Gt(Box<Expr>, Box<Expr>),
    Ge(Box<Expr>, Box<Expr>),
    // Boolean logic
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
    Not(Box<Expr>),
    // Path expression: a.b.c → Path(Name("a"), "b") or Path(Path(...), "c")
    Path(Box<Expr>, String),
    // Function call: func_name(arg1, arg2, ...)
    FunctionCall(String, Vec<Expr>),
    // Function call with named arguments: func_name(a: expr, b: expr)
    NamedFunctionCall(String, Vec<(String, Expr)>),
    // If-then-else
    If(Box<Expr>, Box<Expr>, Box<Expr>),
    // List constructor: [e1, e2, ...]
    List(Vec<Expr>),
    // Context constructor: {key: value, ...}
    Context(Vec<(String, Expr)>),
    // Range: [start..end] or (start..end) etc.
    Range {
        start: Box<Expr>,
        end: Box<Expr>,
        start_inclusive: bool,
        end_inclusive: bool,
    },
    // for x in list return expr
    For(String, Box<Expr>, Box<Expr>),
    // some x in list satisfies condition
    Some(String, Box<Expr>, Box<Expr>),
    // every x in list satisfies condition
    Every(String, Box<Expr>, Box<Expr>),
    // list[filter]
    Filter(Box<Expr>, Box<Expr>),
    // x in range_or_list
    In(Box<Expr>, Box<Expr>),
    // instance of type check (simplified: just return value)
    InstanceOf(Box<Expr>, String),
}
