//! The `fromAi()` parameters of an input mapping, as Zeebe lists them in
//! `adHocSubProcessElements` for the AI Agent connector.

use crate::ast::Expr;
use crate::{lexer, parser};

const PARAMETERS: [&str; 5] = ["value", "description", "type", "schema", "options"];

/// The `fromAi(value, description, type, schema, options)` calls in a FEEL input
/// mapping `source` (with its leading `=`), in the order they appear, each as
/// `{ name, description?, type?, schema?, options? }`: the fields of Zeebe's
/// `AdHocActivityParameter`, which leaves out a field that is null or empty.
///
/// As in Zeebe's `FromAiTaggedParameterExtractor`, `name` is the whole reference the
/// value is, joined with dots (`toolCall.orderId`, or `orderId` for a plain variable);
/// a description or type must be a string literal, and a schema or options a context
/// of literals. The arguments of a `fromAi()` call are not searched for more calls.
/// Zeebe rejects the deployment of a call that breaks those rules; here the call, or
/// the argument, is left out.
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
            _ => return false,
        };
        let arg = |name: &str| args.iter().find(|(arg, _)| *arg == name).map(|(_, value)| *value);
        let Some(name) = arg("value").and_then(reference) else { return true };
        let mut parameter = serde_json::Map::new();
        parameter.insert("name".into(), name.into());
        for field in ["description", "type"] {
            if let Some(Expr::Str(text)) = arg(field) {
                if !text.is_empty() {
                    parameter.insert(field.into(), text.clone().into());
                }
            }
        }
        for field in ["schema", "options"] {
            if let Some(context @ Expr::Context(entries)) = arg(field) {
                if let Some(value) = constant(context).filter(|_| !entries.is_empty()) {
                    parameter.insert(field.into(), value);
                }
            }
        }
        found.push(serde_json::Value::Object(parameter));
        true
    });
    found
}

/// `a.b.c` for a reference to a variable or a path into one, as FEEL's `Ref` names it.
fn reference(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Name(name) => Some(name.clone()),
        Expr::Path(base, key) => reference(base).map(|base| format!("{base}.{key}")),
        _ => None,
    }
}

/// The value of a literal: a string, a number, a boolean, or a list or context of literals.
fn constant(expr: &Expr) -> Option<serde_json::Value> {
    Some(match expr {
        Expr::Str(text) => text.clone().into(),
        Expr::Integer(n) => (*n).into(),
        Expr::Float(n) => serde_json::Number::from_f64(*n)?.into(),
        Expr::Neg(inner) => match inner.as_ref() {
            Expr::Integer(n) => (-*n).into(),
            Expr::Float(n) => serde_json::Number::from_f64(-*n)?.into(),
            _ => return None,
        },
        Expr::Bool(b) => (*b).into(),
        Expr::List(items) => items.iter().map(constant).collect::<Option<Vec<_>>>()?.into(),
        Expr::Context(entries) => serde_json::Value::Object(
            entries.iter().map(|(key, value)| Some((key.clone(), constant(value)?))).collect::<Option<_>>()?,
        ),
        _ => return None,
    })
}

/// Visit `expr` and then every expression inside it, in source order, except the
/// expressions inside one that `visit` returns `true` for.
fn walk(expr: &Expr, visit: &mut dyn FnMut(&Expr) -> bool) {
    if visit(expr) {
        return;
    }
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

    // The cases of Zeebe's AdHocSubProcessElementsVariableTest (COMPLEX_TOOL and
    // SERVICE_TASK) and TaggedParameterExtractorTest.
    #[test]
    fn names_a_parameter_by_its_whole_reference() {
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.a, "Input A", "number")"#),
            vec![json!({ "name": "toolCall.a", "description": "Input A", "type": "number" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=fromAi(b, "Input B", "number")"#),
            vec![json!({ "name": "b", "description": "Input B", "type": "number" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=string(fromAi(toolCall.c, "Input C", "number"))"#),
            vec![json!({ "name": "toolCall.c", "description": "Input C", "type": "number" })],
        );
        assert_eq!(from_ai_parameters("=fromAi(toolCall.a.b)"), vec![json!({ "name": "toolCall.a.b" })]);
        assert!(from_ai_parameters("=123456").is_empty());
    }

    #[test]
    fn reads_positional_and_named_parameters() {
        assert_eq!(
            from_ai_parameters(
                r#"=fromAi(toolCall.aSimpleValue, "A simple value", "string", { enum: ["A", "B", "C"] }, { optional: true })"#
            ),
            vec![json!({
                "name": "toolCall.aSimpleValue", "description": "A simple value", "type": "string",
                "schema": { "enum": ["A", "B", "C"] }, "options": { "optional": true },
            })],
        );
        assert_eq!(
            from_ai_parameters(
                r#"=fromAi(description: "A simple value", options: { optional: true }, schema: { enum: ["A", "B", "C"] }, type: "string", value: aSimpleValue)"#
            ),
            vec![json!({
                "name": "aSimpleValue", "description": "A simple value", "type": "string",
                "schema": { "enum": ["A", "B", "C"] }, "options": { "optional": true },
            })],
        );
        let complex = r#"={
  comment: "Multiple params, positional & named, simple & complex",
  foo: [
    fromAi(firstValue),
    string(fromAi(toolCall.secondValue, "The second value",  "integer"))
  ],
  bar: {
    baz: fromAi(description: "The third value to add", value: toolCall.thirdValue),
    qux: fromAi(toolCall.fourthValue, "The fourth value to add", "array", {
      "items": {
        "type": "string",
        "enum": ["foo", "bar", "baz"]
      }
    })
  }
}"#;
        assert_eq!(
            from_ai_parameters(complex),
            vec![
                json!({ "name": "firstValue" }),
                json!({ "name": "toolCall.secondValue", "description": "The second value", "type": "integer" }),
                json!({ "name": "toolCall.thirdValue", "description": "The third value to add" }),
                json!({
                    "name": "toolCall.fourthValue", "description": "The fourth value to add", "type": "array",
                    "schema": { "items": { "type": "string", "enum": ["foo", "bar", "baz"] } },
                }),
            ],
        );
        assert_eq!(
            from_ai_parameters(r#"="https://example.com/" + fromAi(toolCall.urlPath, "The URL path to use", "string")"#),
            vec![json!({ "name": "toolCall.urlPath", "description": "The URL path to use", "type": "string" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.n, "N", "number", { minimum: -1, maximum: 2.5, nullable: false })"#),
            vec![json!({
                "name": "toolCall.n", "description": "N", "type": "number",
                "schema": { "minimum": -1, "maximum": 2.5, "nullable": false },
            })],
        );
    }

    #[test]
    fn leaves_out_what_zeebe_would_reject_or_omit() {
        assert!(from_ai_parameters("fromAi(toolCall.x)").is_empty(), "not an expression");
        // Zeebe rejects the deployment of a value that is not a reference ...
        assert!(from_ai_parameters(r#"=fromAi("toolCall.x")"#).is_empty());
        assert!(from_ai_parameters("=fromAi(10)").is_empty());
        // ... and of a description or type that is not a string literal, or a schema or
        // options that is not a context of literals.
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.x, "a" + "b", 10, append([], 1), "dummy")"#),
            vec![json!({ "name": "toolCall.x" })],
        );
        // Null and empty fields are left out of Zeebe's variable (`@JsonInclude(NON_EMPTY)`).
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.id, null, "", {}, null)"#),
            vec![json!({ "name": "toolCall.id" })],
        );
        // The arguments of a call are not searched for more calls.
        assert!(from_ai_parameters("=fromAi(fromAi(toolCall.x))").is_empty());
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
