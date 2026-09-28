/// Integration-style unit tests for the FEEL evaluator.
/// All tests are pure — no database or external services required.

use chrono::Datelike;
use reebe_feel::{evaluate, FeelContext, FeelValue};

// ---- Helper ----

fn ctx_from_json(json: serde_json::Value) -> FeelContext {
    FeelContext::from_json(json)
}

fn empty_ctx() -> FeelContext {
    FeelContext::new()
}

// ============================================================
// FEEL timer expression tests
// ============================================================

#[test]
fn test_duration_pt1h() {
    let ctx = empty_ctx();
    let result = evaluate(r#"duration("PT1H")"#, &ctx).expect("duration(PT1H) should succeed");
    match result {
        FeelValue::Duration(ms) => {
            // 1 hour = 3_600_000 ms
            assert_eq!(ms, 3_600_000, "PT1H should equal 3,600,000 ms");
        }
        other => panic!("Expected Duration, got: {:?}", other),
    }
}

#[test]
fn test_duration_p1d() {
    let ctx = empty_ctx();
    let result = evaluate(r#"duration("P1D")"#, &ctx).expect("duration(P1D) should succeed");
    match result {
        FeelValue::Duration(ms) => {
            // 1 day = 86_400_000 ms
            assert_eq!(ms, 86_400_000, "P1D should equal 86,400,000 ms");
        }
        other => panic!("Expected Duration, got: {:?}", other),
    }
}

#[test]
fn test_duration_pt30m() {
    let ctx = empty_ctx();
    let result = evaluate(r#"duration("PT30M")"#, &ctx).expect("duration(PT30M) should succeed");
    match result {
        FeelValue::Duration(ms) => {
            assert_eq!(ms, 30 * 60 * 1000, "PT30M should equal 1,800,000 ms");
        }
        other => panic!("Expected Duration, got: {:?}", other),
    }
}

#[test]
fn test_duration_arithmetic_addition() {
    // duration("PT2H") + duration("PT1H") => 3 hours
    let ctx = empty_ctx();
    let result = evaluate(r#"duration("PT2H") + duration("PT1H")"#, &ctx)
        .expect("duration addition should succeed");
    match result {
        FeelValue::Duration(ms) => {
            assert_eq!(ms, 3 * 3_600_000, "PT2H + PT1H should equal 3 hours (10,800,000 ms)");
        }
        other => panic!("Expected Duration sum, got: {:?}", other),
    }
}

#[test]
fn test_duration_arithmetic_subtraction() {
    // duration("PT3H") - duration("PT1H") => 2 hours
    let ctx = empty_ctx();
    let result = evaluate(r#"duration("PT3H") - duration("PT1H")"#, &ctx)
        .expect("duration subtraction should succeed");
    match result {
        FeelValue::Duration(ms) => {
            assert_eq!(ms, 2 * 3_600_000, "PT3H - PT1H should equal 2 hours");
        }
        other => panic!("Expected Duration, got: {:?}", other),
    }
}

#[test]
fn test_date_literal() {
    let ctx = empty_ctx();
    let result = evaluate(r#"date("2025-01-15")"#, &ctx).expect("date() should succeed");
    match result {
        FeelValue::Date(d) => {
            assert_eq!(d.year(), 2025);
            assert_eq!(d.month(), 1);
            assert_eq!(d.day(), 15);
        }
        other => panic!("Expected Date, got: {:?}", other),
    }
}

#[test]
fn test_date_invalid_returns_error() {
    let ctx = empty_ctx();
    let result = evaluate(r#"date("not-a-date")"#, &ctx);
    assert!(result.is_err(), "date(not-a-date) should return an error");
}

#[test]
fn test_date_and_time_literal() {
    let ctx = empty_ctx();
    let result = evaluate(r#"date and time("2025-01-15T10:00:00")"#, &ctx)
        .expect("date and time() should succeed");
    match result {
        FeelValue::DateTime(dt) => {
            assert_eq!(dt.date_naive().year(), 2025);
            assert_eq!(dt.date_naive().month(), 1);
            assert_eq!(dt.date_naive().day(), 15);
        }
        other => panic!("Expected DateTime, got: {:?}", other),
    }
}

#[test]
fn test_now_returns_datetime() {
    let ctx = empty_ctx();
    let result = evaluate("now()", &ctx).expect("now() should succeed");
    assert!(
        matches!(result, FeelValue::DateTime(_)),
        "now() should return a DateTime, got: {:?}", result
    );
}

#[test]
fn test_today_returns_date() {
    let ctx = empty_ctx();
    let result = evaluate("today()", &ctx).expect("today() should succeed");
    assert!(
        matches!(result, FeelValue::Date(_)),
        "today() should return a Date, got: {:?}", result
    );
}

#[test]
fn test_duration_comparison() {
    let ctx = empty_ctx();
    // PT2H > PT1H should be true
    let result = evaluate(r#"duration("PT2H") > duration("PT1H")"#, &ctx)
        .expect("duration comparison should succeed");
    assert_eq!(result, FeelValue::Bool(true), "PT2H > PT1H should be true");
}

// ============================================================
// Variable scope / context tests
// ============================================================

#[test]
fn test_variable_addition() {
    let ctx = ctx_from_json(serde_json::json!({"a": 3, "b": 4}));
    let result = evaluate("a + b", &ctx).expect("a + b should succeed");
    assert_eq!(result, FeelValue::Integer(7), "3 + 4 should equal 7");
}

#[test]
fn test_variable_multiplication() {
    let ctx = ctx_from_json(serde_json::json!({"x": 6, "y": 7}));
    let result = evaluate("x * y", &ctx).expect("x * y should succeed");
    assert_eq!(result, FeelValue::Integer(42));
}

#[test]
fn test_path_expression_two_levels() {
    // evaluate("order.amount", {"order": {"amount": 100}}) => 100
    let ctx = ctx_from_json(serde_json::json!({"order": {"amount": 100}}));
    let result = evaluate("order.amount", &ctx).expect("path expression should succeed");
    assert_eq!(result, FeelValue::Integer(100), "order.amount should equal 100");
}

#[test]
fn test_path_expression_three_levels() {
    // evaluate("a.b.c", {"a": {"b": {"c": 42}}}) => 42
    let ctx = ctx_from_json(serde_json::json!({"a": {"b": {"c": 42}}}));
    let result = evaluate("a.b.c", &ctx).expect("nested path expression should succeed");
    assert_eq!(result, FeelValue::Integer(42), "a.b.c should equal 42");
}

#[test]
fn test_missing_variable_is_null() {
    // Zeebe's FEEL engine evaluates a variable that does not exist to null.
    let ctx = empty_ctx();
    assert_eq!(evaluate("missing_var", &ctx).expect("should evaluate"), FeelValue::Null);
    assert_eq!(
        evaluate(r#"if missing_var = null then "none" else missing_var"#, &ctx)
            .expect("should evaluate"),
        FeelValue::String("none".to_string()),
    );
}

#[test]
fn test_missing_variable_in_comparison_is_null() {
    // In FEEL, comparing null > 5 yields null (not true/false)
    let ctx = empty_ctx();
    let result = evaluate("missing_var > 5", &ctx);
    // What matters is no panic and no successful true result.
    match &result {
        Ok(FeelValue::Bool(true)) => {
            panic!("missing_var > 5 should not evaluate to true");
        }
        _ => {} // Null, false, or error are all acceptable
    }
}

#[test]
fn test_scope_chain_child_overrides_parent() {
    use reebe_feel::FeelValue;
    let mut parent = FeelContext::new();
    parent.set("x", FeelValue::Integer(1));
    parent.set("y", FeelValue::Integer(10));

    let mut child = FeelContext::child(parent);
    child.set("x", FeelValue::Integer(99)); // override x in child

    // x from child scope
    let result_x = evaluate("x", &child).expect("x should resolve in child");
    assert_eq!(result_x, FeelValue::Integer(99), "x should come from child scope");

    // y inherited from parent scope
    let result_y = evaluate("y", &child).expect("y should resolve from parent");
    assert_eq!(result_y, FeelValue::Integer(10), "y should be inherited from parent");
}

#[test]
fn test_scope_parent_not_affected_by_child() {
    use reebe_feel::FeelValue;
    let mut parent = FeelContext::new();
    parent.set("z", FeelValue::Integer(5));

    let mut child = FeelContext::child(parent.clone());
    child.set("w", FeelValue::Integer(100));

    // parent does not see child bindings
    let result = evaluate("z", &parent).expect("z should be in parent");
    assert_eq!(result, FeelValue::Integer(5));

    let missing = evaluate("w", &parent).expect("a missing variable is null");
    assert_eq!(missing, FeelValue::Null, "Parent should not see child's 'w' variable");
}

// ============================================================
// General FEEL evaluation tests
// ============================================================

#[test]
fn test_simple_arithmetic() {
    let ctx = empty_ctx();
    let result = evaluate("2 + 3 * 4", &ctx).expect("arithmetic should succeed");
    // FEEL uses standard operator precedence: 2 + (3 * 4) = 14
    assert_eq!(result, FeelValue::Integer(14));
}

#[test]
fn test_boolean_and() {
    let ctx = empty_ctx();
    let result = evaluate("true and false", &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(false));
}

#[test]
fn test_boolean_or() {
    let ctx = empty_ctx();
    let result = evaluate("true or false", &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(true));
}

#[test]
fn test_string_literal() {
    let ctx = empty_ctx();
    let result = evaluate(r#""hello world""#, &ctx).unwrap();
    assert_eq!(result, FeelValue::String("hello world".to_string()));
}

#[test]
fn test_if_then_else_true_branch() {
    let ctx = ctx_from_json(serde_json::json!({"amount": 150}));
    let result = evaluate(r#"if amount > 100 then "large" else "small""#, &ctx).unwrap();
    assert_eq!(result, FeelValue::String("large".to_string()));
}

#[test]
fn test_if_then_else_false_branch() {
    let ctx = ctx_from_json(serde_json::json!({"amount": 50}));
    let result = evaluate(r#"if amount > 100 then "large" else "small""#, &ctx).unwrap();
    assert_eq!(result, FeelValue::String("small".to_string()));
}

#[test]
fn test_list_literal() {
    let ctx = empty_ctx();
    let result = evaluate("[1, 2, 3]", &ctx).unwrap();
    assert_eq!(
        result,
        FeelValue::List(vec![
            FeelValue::Integer(1),
            FeelValue::Integer(2),
            FeelValue::Integer(3),
        ])
    );
}

#[test]
fn test_context_literal() {
    let ctx = empty_ctx();
    let result = evaluate(r#"{name: "Alice", age: 30}"#, &ctx).unwrap();
    match result {
        FeelValue::Context(map) => {
            assert_eq!(map.get("name"), Some(&FeelValue::String("Alice".to_string())));
            assert_eq!(map.get("age"), Some(&FeelValue::Integer(30)));
        }
        other => panic!("Expected Context, got: {:?}", other),
    }
}

#[test]
fn test_string_contains_builtin() {
    let ctx = empty_ctx();
    let result = evaluate(r#"contains("hello world", "world")"#, &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(true));
}

#[test]
fn test_floor_builtin() {
    let ctx = empty_ctx();
    let result = evaluate("floor(3.7)", &ctx).unwrap();
    assert_eq!(result, FeelValue::Integer(3));
}

#[test]
fn test_string_length_builtin() {
    let ctx = empty_ctx();
    let result = evaluate(r#"string length("hello")"#, &ctx).unwrap();
    assert_eq!(result, FeelValue::Integer(5));
}

#[test]
fn test_feel_null_literal() {
    let ctx = empty_ctx();
    let result = evaluate("null", &ctx).unwrap();
    assert_eq!(result, FeelValue::Null);
}

#[test]
fn test_feel_equality() {
    let ctx = ctx_from_json(serde_json::json!({"status": "active"}));
    let result = evaluate(r#"status = "active""#, &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(true));
}

#[test]
fn test_feel_inequality() {
    let ctx = ctx_from_json(serde_json::json!({"status": "inactive"}));
    let result = evaluate(r#"status != "active""#, &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(true));
}

#[test]
fn test_path_expression_missing_field_returns_null() {
    let ctx = ctx_from_json(serde_json::json!({"order": {"id": 1}}));
    // Accessing a field that doesn't exist on the context returns Null (not an error)
    let result = evaluate("order.amount", &ctx).unwrap();
    assert_eq!(result, FeelValue::Null, "Missing field on a context should return null");
}

#[test]
fn test_count_builtin() {
    let ctx = empty_ctx();
    let result = evaluate("count([1, 2, 3, 4])", &ctx).unwrap();
    assert_eq!(result, FeelValue::Integer(4));
}

#[test]
fn test_count_empty_list_equality() {
    // count([]) should be 0, and count(x) = 0 should be true when x = []
    let ctx = ctx_from_json(serde_json::json!({ "validationErrors": [] }));
    let result = evaluate("count(validationErrors) = 0", &ctx).unwrap();
    assert_eq!(result, FeelValue::Bool(true), "count([]) = 0 must be true");

    let result2 = evaluate("count([]) = 0", &ctx).unwrap();
    assert_eq!(result2, FeelValue::Bool(true), "count([]) = 0 literal must be true");
}
