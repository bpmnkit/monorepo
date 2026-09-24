//! The `fromAi()` parameters of an input mapping, as the AI Agent connector reads them
//! from `adHocSubProcessElements`.

use crate::ast::Expr;
use crate::context::FeelContext;
use crate::{evaluator, lexer, parser};

const PARAMETERS: [&str; 5] = ["value", "description", "type", "schema", "options"];

/// The `fromAi(toolCall.<name>, description, type, schema, options)` calls in a FEEL
/// input mapping `source` (with its leading `=`), in the order they appear, each as
/// `{ name, description?, type?, schema?, options? }`. A description or type that is not
/// a string constant, and a schema or options that is not a context of constants, is
/// left out; a call whose value is not `toolCall.<name>` is skipped.
pub fn from_ai_parameters(source: &str) -> Vec<serde_json::Value> {
    let source = source.trim();
    let Some(expression) = source.strip_prefix('=') else { return Vec::new() };
    if !expression.contains("fromAi") {
        return Vec::new();
    }
    let Ok(ast) = lexer::tokenize(expression).and_then(parser::parse) else { return Vec::new() };
    let mut found = Vec::new();
    walk(&ast, &mut |node| {
        let args: Vec<(&str, &Expr)> = match node {
            Expr::FunctionCall(name, args) if name == "fromAi" => {
                PARAMETERS.iter().copied().zip(args.iter()).collect()
            }
            Expr::NamedFunctionCall(name, args) if name == "fromAi" => {
                args.iter().map(|(arg, value)| (arg.as_str(), value)).collect()
            }
            _ => return,
        };
        let arg = |name: &str| args.iter().find(|(arg, _)| *arg == name).map(|(_, value)| *value);
        let Some(Expr::Path(base, key)) = arg("value") else { return };
        if !matches!(base.as_ref(), Expr::Name(name) if name == "toolCall") {
            return;
        }
        let mut parameter = serde_json::Map::new();
        parameter.insert("name".into(), key.clone().into());
        let wanted: [(&str, fn(&serde_json::Value) -> bool); 4] = [
            ("description", serde_json::Value::is_string),
            ("type", serde_json::Value::is_string),
            ("schema", serde_json::Value::is_object),
            ("options", serde_json::Value::is_object),
        ];
        for (field, is_wanted) in wanted {
            if let Some(value) = arg(field).and_then(constant).filter(is_wanted) {
                parameter.insert(field.into(), value);
            }
        }
        found.push(serde_json::Value::Object(parameter));
    });
    found
}

/// The value of an argument that must be a constant.
fn constant(expr: &Expr) -> Option<serde_json::Value> {
    evaluator::eval(expr, &FeelContext::new()).ok().map(serde_json::Value::from)
}

/// Visit `expr` and then every expression inside it, in source order.
fn walk(expr: &Expr, visit: &mut dyn FnMut(&Expr)) {
    visit(expr);
    match expr {
        Expr::Null | Expr::Bool(_) | Expr::Integer(_) | Expr::Float(_) | Expr::Str(_) | Expr::Name(_) => {}
        Expr::Add(a, b) | Expr::Sub(a, b) | Expr::Mul(a, b) | Expr::Div(a, b)
        | Expr::Eq(a, b) | Expr::Ne(a, b) | Expr::Lt(a, b) | Expr::Le(a, b) | Expr::Gt(a, b) | Expr::Ge(a, b)
        | Expr::And(a, b) | Expr::Or(a, b) | Expr::Filter(a, b) | Expr::In(a, b) => {
            walk(a, visit);
            walk(b, visit);
        }
        Expr::Neg(a) | Expr::Not(a) | Expr::Path(a, _) | Expr::InstanceOf(a, _) => walk(a, visit),
        Expr::FunctionCall(_, args) | Expr::List(args) => args.iter().for_each(|a| walk(a, visit)),
        Expr::NamedFunctionCall(_, args) | Expr::Context(args) => args.iter().for_each(|(_, a)| walk(a, visit)),
        Expr::If(a, b, c) => {
            walk(a, visit);
            walk(b, visit);
            walk(c, visit);
        }
        Expr::Range { start, end, .. } => {
            walk(start, visit);
            walk(end, visit);
        }
        Expr::For(_, a, b) | Expr::Some(_, a, b) | Expr::Every(_, a, b) => {
            walk(a, visit);
            walk(b, visit);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::from_ai_parameters;
    use serde_json::json;

    #[test]
    fn reads_positional_and_named_parameters() {
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.query, "Search terms")"#),
            vec![json!({ "name": "query", "description": "Search terms" })],
        );
        assert_eq!(
            from_ai_parameters(
                r#"=fromAi(toolCall.tags, "Tags", "array", { items: { type: "string" } }, { required: false })"#
            ),
            vec![json!({
                "name": "tags", "description": "Tags", "type": "array",
                "schema": { "items": { "type": "string" } }, "options": { "required": false },
            })],
        );
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.id, null, "number")"#),
            vec![json!({ "name": "id", "type": "number" })],
        );
        assert_eq!(
            from_ai_parameters(
                r#"={ a: fromAi(description: "Third", value: toolCall.third), b: string(fromAi(toolCall.fourth)) }"#
            ),
            vec![json!({ "name": "third", "description": "Third" }), json!({ "name": "fourth" })],
        );
    }

    #[test]
    fn skips_what_is_not_a_tool_call_parameter() {
        assert!(from_ai_parameters("=123").is_empty());
        assert!(from_ai_parameters("fromAi(toolCall.x)").is_empty(), "not an expression");
        assert!(from_ai_parameters(r#"=fromAi(other.x, "not a tool call")"#).is_empty());
    }

    #[test]
    fn from_ai_returns_its_value() {
        let mut ctx = crate::FeelContext::new();
        ctx.set("toolCall", crate::FeelValue::from(json!({ "q": "weather" })));
        let value = crate::evaluate(r#"fromAi(toolCall.q, "The query")"#, &ctx).unwrap();
        assert_eq!(value, crate::FeelValue::String("weather".into()));
        let named = crate::evaluate(r#"fromAi(description: "The query", value: toolCall.q)"#, &ctx).unwrap();
        assert_eq!(named, crate::FeelValue::String("weather".into()));
    }
}
