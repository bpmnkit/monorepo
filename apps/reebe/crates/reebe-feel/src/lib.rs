mod ast;
mod builtins;
mod context;
mod evaluator;
mod from_ai;
mod lexer;
mod parser;
pub mod types;

pub use context::FeelContext;
pub use from_ai::from_ai_parameters;
pub use types::{FeelError, FeelValue};

/// Check whether an expression string is a FEEL expression.
/// FEEL expressions are prefixed with `=`.
pub fn is_feel_expression(expression: &str) -> bool {
    expression.starts_with('=')
}

/// Parse and evaluate a FEEL expression string with the given context.
///
/// If the expression starts with `=`, it is treated as a FEEL expression and
/// evaluated. Otherwise, it is returned as a string literal.
pub fn parse_and_evaluate(
    expression: &str,
    context: &FeelContext,
) -> Result<FeelValue, FeelError> {
    if let Some(feel_expr) = expression.strip_prefix('=') {
        evaluate(feel_expr.trim(), context)
    } else {
        Ok(FeelValue::String(expression.to_string()))
    }
}

/// Evaluate a FEEL expression string (without the leading `=`) with the given context.
pub fn evaluate(expression: &str, context: &FeelContext) -> Result<FeelValue, FeelError> {
    let tokens = lexer::tokenize(expression)?;
    let expr = parser::parse(tokens)?;
    evaluator::eval(&expr, context)
}
