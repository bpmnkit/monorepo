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
/// A call that breaks those rules is `Err` with the extractor's message, with which
/// Zeebe rejects the deployment. A source that is not a FEEL expression, or that does
/// not parse, has no parameters.
pub fn from_ai_parameters(source: &str) -> Result<Vec<serde_json::Value>, String> {
    let source = source.trim();
    let Some(expression) = source.strip_prefix('=') else { return Ok(Vec::new()) };
    if !expression.contains("fromAi") {
        return Ok(Vec::new());
    }
    let Ok(ast) = lexer::tokenize(expression).and_then(parser::parse) else { return Ok(Vec::new()) };
    let mut found = Vec::new();
    let mut error = None;
    walk(&ast, &mut |node| {
        if error.is_some() {
            return true;
        }
        let args: Vec<(&str, &Expr)> = match node {
            Expr::FunctionCall(name, args) if name == "fromAi" => {
                PARAMETERS.iter().copied().zip(args.iter()).collect()
            }
            Expr::NamedFunctionCall(name, args) if name == "fromAi" => {
                args.iter().map(|(arg, value)| (arg.as_str(), value)).collect()
            }
            _ => return false,
        };
        match parameter(&args) {
            Ok(parameter) => found.push(parameter),
            Err(message) => error = Some(message),
        }
        true
    });
    match error {
        Some(message) => Err(message),
        None => Ok(found),
    }
}

/// The parameter of one `fromAi()` call, or the message Zeebe's extractor throws for it.
fn parameter(args: &[(&str, &Expr)]) -> Result<serde_json::Value, String> {
    let arg = |name: &str| args.iter().find(|(arg, _)| *arg == name).map(|(_, value)| *value);
    let mut parameter = serde_json::Map::new();
    parameter.insert("name".into(), parameter_name(arg("value"))?.into());
    for field in ["description", "type"] {
        match arg(field) {
            None => {}
            Some(Expr::Str(text)) => {
                if !text.is_empty() {
                    parameter.insert(field.into(), text.clone().into());
                }
            }
            Some(other) => {
                return Err(format!(
                    "Expected fromAi() parameter '{field}' to be a string, but received '{}'.",
                    mismatch_value(other),
                ))
            }
        }
    }
    for field in ["schema", "options"] {
        match arg(field) {
            None => {}
            Some(Expr::Context(entries)) => {
                let value = context_value(entries)?;
                if !entries.is_empty() {
                    parameter.insert(field.into(), value);
                }
            }
            Some(other) => {
                return Err(format!(
                    "Expected fromAi() parameter '{field}' to be a context (map), but received '{}'.",
                    mismatch_value(other),
                ))
            }
        }
    }
    Ok(serde_json::Value::Object(parameter))
}

/// The name of the parameter a `fromAi()` value tags: the whole reference it is.
fn parameter_name(value: Option<&Expr>) -> Result<String, String> {
    // Zeebe's extractor switches on the missing value, which throws a
    // NullPointerException without a message.
    let Some(value) = value else { return Err("null".to_string()) };
    reference(value).ok_or_else(|| {
        let received = match value {
            Expr::Str(text) => format!("string '{text}'"),
            other => mismatch_value(other),
        };
        format!(
            "Expected fromAi() parameter 'value' to be a reference (e.g. 'toolCall.customParameter'), but received {received}."
        )
    })
}

/// `a.b.c` for a reference to a variable or a path into one, as FEEL's `Ref` names it.
fn reference(expr: &Expr) -> Option<String> {
    match expr {
        Expr::Name(name) => Some(name.clone()),
        Expr::Path(base, key) => reference(base).map(|base| format!("{base}.{key}")),
        _ => None,
    }
}

/// How Zeebe's extractor shows a value of the wrong kind: a literal by its value,
/// anything else as the FEEL engine's expression tree.
fn mismatch_value(expr: &Expr) -> String {
    match expr {
        Expr::Str(text) => text.clone(),
        Expr::Integer(n) => n.to_string(),
        Expr::Float(n) => n.to_string(),
        Expr::Bool(b) => b.to_string(),
        other => scala_tree(other),
    }
}

/// The value of a context of literals, or Zeebe's message for an entry that is not one.
fn context_value(entries: &[(String, Expr)]) -> Result<serde_json::Value, String> {
    entries
        .iter()
        .map(|(key, value)| Ok((key.clone(), constant(value)?)))
        .collect::<Result<serde_json::Map<_, _>, String>>()
        .map(serde_json::Value::Object)
}

/// The value of a literal: a string, a number, a boolean, or a list or context of literals.
fn constant(expr: &Expr) -> Result<serde_json::Value, String> {
    let unsupported = |expr: &Expr| {
        format!("Unsupported expression value in fromAi() function invocation: {}", scala_class(expr))
    };
    Ok(match expr {
        Expr::Str(text) => text.clone().into(),
        Expr::Integer(n) => (*n).into(),
        Expr::Float(n) => serde_json::Number::from_f64(*n).ok_or_else(|| unsupported(expr))?.into(),
        // FEEL reads a negative number literal as one number.
        Expr::Neg(inner) => match inner.as_ref() {
            Expr::Integer(n) => (-*n).into(),
            Expr::Float(n) => serde_json::Number::from_f64(-*n).ok_or_else(|| unsupported(expr))?.into(),
            _ => return Err(unsupported(expr)),
        },
        Expr::Bool(b) => (*b).into(),
        Expr::List(items) => items.iter().map(constant).collect::<Result<Vec<_>, _>>()?.into(),
        Expr::Context(entries) => context_value(entries)?,
        _ => return Err(unsupported(expr)),
    })
}

/// The simple class name of the FEEL engine's (feel-scala's) node for `expr`.
fn scala_class(expr: &Expr) -> String {
    let tree = scala_tree(expr);
    match tree.find('(') {
        Some(end) => tree[..end].to_string(),
        // A case object, such as `ConstNull`, is the instance of the class `ConstNull$`.
        None => format!("{tree}$"),
    }
}

/// `expr` as the FEEL engine's (feel-scala's) expression tree prints itself (a Scala
/// case class's `toString`), which Zeebe's messages show for a value of the wrong kind.
fn scala_tree(expr: &Expr) -> String {
    let two = |name: &str, a: &Expr, b: &Expr| format!("{name}({},{})", scala_tree(a), scala_tree(b));
    let list = |items: Vec<String>| format!("List({})", items.join(", "));
    let bound = |name: &str, a: &Expr, b: &Expr| format!("List(({name},{})),{}", scala_tree(a), scala_tree(b));
    match expr {
        Expr::Null => "ConstNull".to_string(),
        Expr::Bool(b) => format!("ConstBool({b})"),
        Expr::Integer(n) => format!("ConstNumber({n})"),
        Expr::Float(n) => format!("ConstNumber({n})"),
        Expr::Str(text) => format!("ConstString({text})"),
        Expr::Name(_) | Expr::Path(..) if reference(expr).is_some() => {
            let names = reference(expr).unwrap_or_default();
            format!("Ref({})", list(names.split('.').map(str::to_string).collect()))
        }
        Expr::Name(name) => format!("Ref(List({name}))"),
        Expr::Path(base, key) => format!("PathExpression({},{key})", scala_tree(base)),
        Expr::Add(a, b) => two("Addition", a, b),
        Expr::Sub(a, b) => two("Subtraction", a, b),
        Expr::Mul(a, b) => two("Multiplication", a, b),
        Expr::Div(a, b) => two("Division", a, b),
        Expr::Neg(a) => format!("ArithmeticNegation({})", scala_tree(a)),
        Expr::Eq(a, b) => two("Equal", a, b),
        Expr::Ne(a, b) => format!("Not({})", two("Equal", a, b)),
        Expr::Lt(a, b) => two("LessThan", a, b),
        Expr::Le(a, b) => two("LessOrEqual", a, b),
        Expr::Gt(a, b) => two("GreaterThan", a, b),
        Expr::Ge(a, b) => two("GreaterOrEqual", a, b),
        Expr::And(a, b) => two("Conjunction", a, b),
        Expr::Or(a, b) => two("Disjunction", a, b),
        Expr::Not(a) => format!("Not({})", scala_tree(a)),
        Expr::FunctionCall(name, args) => format!(
            "FunctionInvocation({name},PositionalFunctionParameters({}))",
            list(args.iter().map(scala_tree).collect()),
        ),
        Expr::NamedFunctionCall(name, args) => format!(
            "FunctionInvocation({name},NamedFunctionParameters(Map({})))",
            args.iter().map(|(k, v)| format!("{k} -> {}", scala_tree(v))).collect::<Vec<_>>().join(", "),
        ),
        Expr::If(c, t, e) => format!("If({},{},{})", scala_tree(c), scala_tree(t), scala_tree(e)),
        Expr::List(items) => format!("ConstList({})", list(items.iter().map(scala_tree).collect())),
        Expr::Context(entries) => format!(
            "ConstContext({})",
            list(entries.iter().map(|(k, v)| format!("({k},{})", scala_tree(v))).collect()),
        ),
        Expr::Range { start, end, .. } => two("ConstRange", start, end),
        Expr::For(name, a, b) => format!("For({})", bound(name, a, b)),
        Expr::Some(name, a, b) => format!("SomeItem({})", bound(name, a, b)),
        Expr::Every(name, a, b) => format!("EveryItem({})", bound(name, a, b)),
        Expr::Filter(a, b) => two("Filter", a, b),
        Expr::In(a, b) => two("In", a, b),
        Expr::InstanceOf(a, type_name) => format!("InstanceOf({},{type_name})", scala_tree(a)),
    }
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
            from_ai_parameters(r#"=fromAi(toolCall.a, "Input A", "number")"#).unwrap(),
            vec![json!({ "name": "toolCall.a", "description": "Input A", "type": "number" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=fromAi(b, "Input B", "number")"#).unwrap(),
            vec![json!({ "name": "b", "description": "Input B", "type": "number" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=string(fromAi(toolCall.c, "Input C", "number"))"#).unwrap(),
            vec![json!({ "name": "toolCall.c", "description": "Input C", "type": "number" })],
        );
        assert_eq!(from_ai_parameters("=fromAi(toolCall.a.b)").unwrap(), vec![json!({ "name": "toolCall.a.b" })]);
        assert!(from_ai_parameters("=123456").unwrap().is_empty());
    }

    #[test]
    fn reads_positional_and_named_parameters() {
        assert_eq!(
            from_ai_parameters(
                r#"=fromAi(toolCall.aSimpleValue, "A simple value", "string", { enum: ["A", "B", "C"] }, { optional: true })"#
            ).unwrap(),
            vec![json!({
                "name": "toolCall.aSimpleValue", "description": "A simple value", "type": "string",
                "schema": { "enum": ["A", "B", "C"] }, "options": { "optional": true },
            })],
        );
        assert_eq!(
            from_ai_parameters(
                r#"=fromAi(description: "A simple value", options: { optional: true }, schema: { enum: ["A", "B", "C"] }, type: "string", value: aSimpleValue)"#
            ).unwrap(),
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
            from_ai_parameters(complex).unwrap(),
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
            from_ai_parameters(r#"="https://example.com/" + fromAi(toolCall.urlPath, "The URL path to use", "string")"#).unwrap(),
            vec![json!({ "name": "toolCall.urlPath", "description": "The URL path to use", "type": "string" })],
        );
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.n, "N", "number", { minimum: -1, maximum: 2.5, nullable: false })"#).unwrap(),
            vec![json!({
                "name": "toolCall.n", "description": "N", "type": "number",
                "schema": { "minimum": -1, "maximum": 2.5, "nullable": false },
            })],
        );
    }

    #[test]
    fn leaves_out_null_and_empty_fields() {
        assert!(from_ai_parameters("fromAi(toolCall.x)").unwrap().is_empty(), "not an expression");
        // Null and empty fields are left out of Zeebe's variable (`@JsonInclude(NON_EMPTY)`).
        assert_eq!(
            from_ai_parameters(r#"=fromAi(toolCall.id, "", "", {})"#).unwrap(),
            vec![json!({ "name": "toolCall.id" })],
        );
    }

    fn rejection(source: &str) -> String {
        from_ai_parameters(source).expect_err(source)
    }

    // The cases of Zeebe's TaggedParameterExtractorTest: a value that is not a reference.
    #[test]
    fn rejects_a_value_that_is_not_a_reference() {
        let prefix = "Expected fromAi() parameter 'value' to be a reference (e.g. 'toolCall.customParameter'), but received ";
        assert_eq!(rejection(r#"=fromAi("toolCall.myVariable")"#), format!("{prefix}string 'toolCall.myVariable'."));
        assert_eq!(rejection("=fromAi(10)"), format!("{prefix}10."));
        assert_eq!(rejection("=fromAi([])"), format!("{prefix}ConstList(List())."));
        assert!(rejection("=fromAi(fromAi(toolCall.myVariable))").starts_with(&format!("{prefix}FunctionInvocation(fromAi")));
        assert_eq!(rejection("=fromAi(null)"), format!("{prefix}ConstNull."));
        // Zeebe's extractor fails on a missing value with a NullPointerException.
        assert_eq!(rejection(r#"=fromAi(description: "no value")"#), "null");
    }

    // The cases of Zeebe's TaggedParameterExtractorTest: a description or type that is not
    // a string, a schema or options that is not a context. Zeebe's test builds a context
    // with `context put`, which this FEEL does not have; `context merge` is the same case.
    #[test]
    fn rejects_a_description_type_schema_or_options_of_the_wrong_kind() {
        assert_eq!(
            rejection("=fromAi(value: toolCall.myVariable, description: 10)"),
            "Expected fromAi() parameter 'description' to be a string, but received '10'.",
        );
        assert!(rejection(r#"=fromAi(value: toolCall.myVariable, description: string join(["A", "simple", "value"], " "))"#)
            .starts_with("Expected fromAi() parameter 'description' to be a string, but received 'FunctionInvocation"));
        assert_eq!(
            rejection("=fromAi(value: toolCall.myVariable, type: 10)"),
            "Expected fromAi() parameter 'type' to be a string, but received '10'.",
        );
        assert!(rejection(r#"=fromAi(value: toolCall.myVariable, type: "str" + "ing")"#)
            .starts_with("Expected fromAi() parameter 'type' to be a string, but received 'Addition"));
        assert_eq!(
            rejection(r#"=fromAi(value: toolCall.myVariable, schema: "dummy")"#),
            "Expected fromAi() parameter 'schema' to be a context (map), but received 'dummy'.",
        );
        assert!(rejection(r#"=fromAi(value: toolCall.myVariable, schema: context merge([{}, { enum: ["A", "B", "C"] }]))"#)
            .starts_with("Expected fromAi() parameter 'schema' to be a context (map), but received 'FunctionInvocation"));
        assert_eq!(
            rejection(r#"=fromAi(value: toolCall.myVariable, options: "dummy")"#),
            "Expected fromAi() parameter 'options' to be a context (map), but received 'dummy'.",
        );
        assert!(rejection(r#"=fromAi(value: toolCall.myVariable, options: context merge([{}, { required: false }]))"#)
            .starts_with("Expected fromAi() parameter 'options' to be a context (map), but received 'FunctionInvocation"));
        // `null` is FEEL's null literal, not a missing argument: Zeebe rejects it too.
        assert_eq!(
            rejection("=fromAi(toolCall.id, null)"),
            "Expected fromAi() parameter 'description' to be a string, but received 'ConstNull'.",
        );
        assert_eq!(
            rejection(r#"=fromAi(toolCall.id, "Id", "string", {}, null)"#),
            "Expected fromAi() parameter 'options' to be a context (map), but received 'ConstNull'.",
        );
        assert_eq!(
            rejection("=fromAi(toolCall.x, true)"),
            "Expected fromAi() parameter 'description' to be a string, but received 'true'.",
        );
    }

    // Zeebe's extractor converts a schema or options entry by entry and rejects one that
    // is not a literal.
    #[test]
    fn rejects_a_schema_or_options_with_an_entry_that_is_not_a_literal() {
        assert_eq!(
            rejection(r#"=fromAi(toolCall.x, "X", "string", { enum: other })"#),
            "Unsupported expression value in fromAi() function invocation: Ref",
        );
        assert_eq!(
            rejection(r#"=fromAi(toolCall.x, "X", "number", { minimum: 1 + 1 })"#),
            "Unsupported expression value in fromAi() function invocation: Addition",
        );
        assert_eq!(
            rejection(r#"=fromAi(toolCall.x, "X", "string", {}, { optional: null })"#),
            "Unsupported expression value in fromAi() function invocation: ConstNull$",
        );
        // The first failing call decides, as the extractor stops there.
        assert_eq!(
            rejection(r#"={ a: fromAi(toolCall.a, 1), b: fromAi(toolCall.b, 2) }"#),
            "Expected fromAi() parameter 'description' to be a string, but received '1'.",
        );
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
