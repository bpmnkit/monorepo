use crate::ast::Expr;
use crate::builtins;
use crate::context::FeelContext;
use crate::types::{compare_values, FeelError, FeelValue};

/// Evaluate a FEEL AST node with the given context.
pub fn eval(expr: &Expr, ctx: &FeelContext) -> Result<FeelValue, FeelError> {
    match expr {
        Expr::Null => Ok(FeelValue::Null),
        Expr::Bool(b) => Ok(FeelValue::Bool(*b)),
        Expr::Integer(n) => Ok(FeelValue::Integer(*n)),
        Expr::Float(f) => Ok(FeelValue::Float(*f)),
        Expr::Str(s) => Ok(FeelValue::String(s.clone())),

        // As in Zeebe's FEEL engine, a variable that does not exist is null.
        Expr::Name(name) => Ok(ctx.get(name).cloned().unwrap_or(FeelValue::Null)),

        Expr::Add(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            eval_add(l, r)
        }

        Expr::Sub(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            eval_arithmetic(l, r, '-')
        }

        Expr::Mul(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            eval_arithmetic(l, r, '*')
        }

        Expr::Div(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            eval_div(l, r)
        }

        Expr::Neg(inner) => {
            let v = eval(inner, ctx)?;
            match v {
                FeelValue::Integer(n) => Ok(FeelValue::Integer(-n)),
                FeelValue::Float(f) => Ok(FeelValue::Float(-f)),
                FeelValue::Null => Ok(FeelValue::Null),
                _ => Err(FeelError::TypeError {
                    expected: "number".to_string(),
                    actual: v.type_name().to_string(),
                }),
            }
        }

        Expr::Eq(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            Ok(FeelValue::Bool(feel_equals(&l, &r)))
        }

        Expr::Ne(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            Ok(FeelValue::Bool(!feel_equals(&l, &r)))
        }

        Expr::Lt(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            if matches!(l, FeelValue::Null) || matches!(r, FeelValue::Null) {
                return Ok(FeelValue::Null);
            }
            match compare_values(&l, &r) {
                Some(ord) => Ok(FeelValue::Bool(ord == std::cmp::Ordering::Less)),
                None => Ok(FeelValue::Null),
            }
        }

        Expr::Le(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            if matches!(l, FeelValue::Null) || matches!(r, FeelValue::Null) {
                return Ok(FeelValue::Null);
            }
            match compare_values(&l, &r) {
                Some(ord) => Ok(FeelValue::Bool(
                    ord == std::cmp::Ordering::Less || ord == std::cmp::Ordering::Equal,
                )),
                None => Ok(FeelValue::Null),
            }
        }

        Expr::Gt(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            if matches!(l, FeelValue::Null) || matches!(r, FeelValue::Null) {
                return Ok(FeelValue::Null);
            }
            match compare_values(&l, &r) {
                Some(ord) => Ok(FeelValue::Bool(ord == std::cmp::Ordering::Greater)),
                None => Ok(FeelValue::Null),
            }
        }

        Expr::Ge(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            let r = eval(rhs, ctx)?;
            if matches!(l, FeelValue::Null) || matches!(r, FeelValue::Null) {
                return Ok(FeelValue::Null);
            }
            match compare_values(&l, &r) {
                Some(ord) => Ok(FeelValue::Bool(
                    ord == std::cmp::Ordering::Greater || ord == std::cmp::Ordering::Equal,
                )),
                None => Ok(FeelValue::Null),
            }
        }

        Expr::And(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            // Short-circuit: if left is false, return false; if null, continue
            match &l {
                FeelValue::Bool(false) => return Ok(FeelValue::Bool(false)),
                FeelValue::Null => {
                    let r = eval(rhs, ctx)?;
                    return match r {
                        FeelValue::Bool(false) => Ok(FeelValue::Bool(false)),
                        _ => Ok(FeelValue::Null),
                    };
                }
                _ => {}
            }
            let r = eval(rhs, ctx)?;
            Ok(FeelValue::Bool(l.is_truthy() && r.is_truthy()))
        }

        Expr::Or(lhs, rhs) => {
            let l = eval(lhs, ctx)?;
            // Short-circuit
            match &l {
                FeelValue::Bool(true) => return Ok(FeelValue::Bool(true)),
                FeelValue::Null => {
                    let r = eval(rhs, ctx)?;
                    return match r {
                        FeelValue::Bool(true) => Ok(FeelValue::Bool(true)),
                        _ => Ok(FeelValue::Null),
                    };
                }
                _ => {}
            }
            let r = eval(rhs, ctx)?;
            Ok(FeelValue::Bool(l.is_truthy() || r.is_truthy()))
        }

        Expr::Not(inner) => {
            let v = eval(inner, ctx)?;
            match v {
                FeelValue::Bool(b) => Ok(FeelValue::Bool(!b)),
                FeelValue::Null => Ok(FeelValue::Null),
                _ => Err(FeelError::TypeError {
                    expected: "boolean".to_string(),
                    actual: v.type_name().to_string(),
                }),
            }
        }

        Expr::Path(obj, field) => {
            let obj_val = eval(obj, ctx)?;
            match obj_val {
                FeelValue::Context(map) => {
                    map.get(field).cloned().ok_or_else(|| FeelValue::Null).or_else(|_| Ok(FeelValue::Null))
                }
                FeelValue::Null => Ok(FeelValue::Null),
                _ => Err(FeelError::TypeError {
                    expected: "context".to_string(),
                    actual: obj_val.type_name().to_string(),
                }),
            }
        }

        Expr::FunctionCall(name, args) => {
            let mut eval_args = Vec::new();
            for arg in args {
                eval_args.push(eval(arg, ctx)?);
            }
            builtins::call_builtin(name, eval_args)
        }

        // Only `fromAi` takes named arguments; it returns its `value`.
        Expr::NamedFunctionCall(name, args) if name.eq_ignore_ascii_case("fromAi") => {
            match args.iter().find(|(arg, _)| arg == "value") {
                Some((_, value)) => eval(value, ctx),
                None => Ok(FeelValue::Null),
            }
        }
        Expr::NamedFunctionCall(name, _) => Err(FeelError::EvaluationError(format!(
            "named arguments are not supported for {name}()"
        ))),

        Expr::If(cond, then_expr, else_expr) => {
            let cond_val = eval(cond, ctx)?;
            if cond_val.is_truthy() {
                eval(then_expr, ctx)
            } else {
                eval(else_expr, ctx)
            }
        }

        Expr::List(items) => {
            let mut result = Vec::new();
            for item in items {
                result.push(eval(item, ctx)?);
            }
            Ok(FeelValue::List(result))
        }

        Expr::Context(pairs) => {
            let mut map = std::collections::HashMap::new();
            for (key, val_expr) in pairs {
                let val = eval(val_expr, ctx)?;
                map.insert(key.clone(), val);
            }
            Ok(FeelValue::Context(map))
        }

        Expr::Range {
            start,
            end,
            start_inclusive,
            end_inclusive,
        } => {
            let start_val = eval(start, ctx)?;
            let end_val = eval(end, ctx)?;
            Ok(FeelValue::Range {
                start: Box::new(start_val),
                end: Box::new(end_val),
                start_inclusive: *start_inclusive,
                end_inclusive: *end_inclusive,
            })
        }

        Expr::For(var, list_expr, body_expr) => {
            let list_val = eval(list_expr, ctx)?;
            let items = match list_val {
                FeelValue::List(items) => items,
                FeelValue::Range { .. } => range_to_list(&list_val)?,
                other => vec![other],
            };
            let mut results = Vec::new();
            for item in items {
                let mut child_ctx = FeelContext::child(ctx.clone());
                child_ctx.set(var.clone(), item);
                results.push(eval(body_expr, &child_ctx)?);
            }
            Ok(FeelValue::List(results))
        }

        Expr::Some(var, list_expr, cond_expr) => {
            let list_val = eval(list_expr, ctx)?;
            let items = match list_val {
                FeelValue::List(items) => items,
                FeelValue::Range { .. } => range_to_list(&list_val)?,
                other => vec![other],
            };
            for item in items {
                let mut child_ctx = FeelContext::child(ctx.clone());
                child_ctx.set(var.clone(), item);
                let result = eval(cond_expr, &child_ctx)?;
                if result.is_truthy() {
                    return Ok(FeelValue::Bool(true));
                }
            }
            Ok(FeelValue::Bool(false))
        }

        Expr::Every(var, list_expr, cond_expr) => {
            let list_val = eval(list_expr, ctx)?;
            let items = match list_val {
                FeelValue::List(items) => items,
                FeelValue::Range { .. } => range_to_list(&list_val)?,
                other => vec![other],
            };
            for item in items {
                let mut child_ctx = FeelContext::child(ctx.clone());
                child_ctx.set(var.clone(), item);
                let result = eval(cond_expr, &child_ctx)?;
                if !result.is_truthy() {
                    return Ok(FeelValue::Bool(false));
                }
            }
            Ok(FeelValue::Bool(true))
        }

        Expr::Filter(list_expr, filter_expr) => {
            let list_val = eval(list_expr, ctx)?;
            let items = match list_val {
                FeelValue::List(items) => items,
                other => vec![other],
            };
            let mut results = Vec::new();
            for item in items {
                let mut child_ctx = FeelContext::child(ctx.clone());
                child_ctx.set("item".to_string(), item.clone());
                // Also add all context keys from item if it's a Context
                if let FeelValue::Context(ref map) = item {
                    for (k, v) in map {
                        child_ctx.set(k.clone(), v.clone());
                    }
                }
                let keep = eval(filter_expr, &child_ctx)?;
                // If filter is an integer, treat as index (1-based)
                match &keep {
                    FeelValue::Integer(idx) => {
                        // Return single item by index (1-based)
                        let idx = *idx;
                        let list_for_index = match eval(list_expr, ctx) {
                            Ok(FeelValue::List(l)) => l,
                            _ => vec![],
                        };
                        let actual_idx = if idx > 0 {
                            (idx - 1) as usize
                        } else if idx < 0 {
                            (list_for_index.len() as i64 + idx) as usize
                        } else {
                            return Err(FeelError::IndexOutOfBounds { index: idx, length: list_for_index.len() });
                        };
                        return list_for_index
                            .into_iter()
                            .nth(actual_idx)
                            .ok_or(FeelError::IndexOutOfBounds { index: idx, length: 0 })
                            .map(|v| FeelValue::List(vec![v]));
                    }
                    _ => {
                        if keep.is_truthy() {
                            results.push(item);
                        }
                    }
                }
            }
            Ok(FeelValue::List(results))
        }

        Expr::In(value_expr, range_or_list_expr) => {
            let value = eval(value_expr, ctx)?;
            let range_or_list = eval(range_or_list_expr, ctx)?;
            Ok(FeelValue::Bool(value_in(&value, &range_or_list)))
        }

        Expr::InstanceOf(expr, _type_name) => {
            // For now, just evaluate and return the value (simplification)
            eval(expr, ctx)
        }
    }
}

fn feel_equals(a: &FeelValue, b: &FeelValue) -> bool {
    match (a, b) {
        (FeelValue::Null, FeelValue::Null) => true,
        (FeelValue::Null, _) | (_, FeelValue::Null) => false,
        (FeelValue::Bool(x), FeelValue::Bool(y)) => x == y,
        (FeelValue::Integer(x), FeelValue::Integer(y)) => x == y,
        (FeelValue::Float(x), FeelValue::Float(y)) => x == y,
        (FeelValue::Integer(x), FeelValue::Float(y)) => (*x as f64) == *y,
        (FeelValue::Float(x), FeelValue::Integer(y)) => *x == (*y as f64),
        (FeelValue::String(x), FeelValue::String(y)) => x == y,
        _ => a == b,
    }
}

fn eval_add(l: FeelValue, r: FeelValue) -> Result<FeelValue, FeelError> {
    match (l, r) {
        (FeelValue::Null, _) | (_, FeelValue::Null) => Ok(FeelValue::Null),
        (FeelValue::Integer(a), FeelValue::Integer(b)) => Ok(FeelValue::Integer(a + b)),
        (FeelValue::Float(a), FeelValue::Float(b)) => Ok(FeelValue::Float(a + b)),
        (FeelValue::Integer(a), FeelValue::Float(b)) => Ok(FeelValue::Float(a as f64 + b)),
        (FeelValue::Float(a), FeelValue::Integer(b)) => Ok(FeelValue::Float(a + b as f64)),
        (FeelValue::String(a), FeelValue::String(b)) => Ok(FeelValue::String(a + &b)),
        (FeelValue::Duration(a), FeelValue::Duration(b)) => Ok(FeelValue::Duration(a + b)),
        (l, r) => Err(FeelError::TypeError {
            expected: "number or string".to_string(),
            actual: format!("{} and {}", l.type_name(), r.type_name()),
        }),
    }
}

fn eval_arithmetic(l: FeelValue, r: FeelValue, op: char) -> Result<FeelValue, FeelError> {
    match (l, r) {
        (FeelValue::Null, _) | (_, FeelValue::Null) => Ok(FeelValue::Null),
        (FeelValue::Integer(a), FeelValue::Integer(b)) => {
            let result = match op {
                '-' => a - b,
                '*' => a * b,
                _ => unreachable!(),
            };
            Ok(FeelValue::Integer(result))
        }
        (FeelValue::Float(a), FeelValue::Float(b)) => {
            let result = match op {
                '-' => a - b,
                '*' => a * b,
                _ => unreachable!(),
            };
            Ok(FeelValue::Float(result))
        }
        (FeelValue::Integer(a), FeelValue::Float(b)) => {
            let a = a as f64;
            let result = match op {
                '-' => a - b,
                '*' => a * b,
                _ => unreachable!(),
            };
            Ok(FeelValue::Float(result))
        }
        (FeelValue::Float(a), FeelValue::Integer(b)) => {
            let b = b as f64;
            let result = match op {
                '-' => a - b,
                '*' => a * b,
                _ => unreachable!(),
            };
            Ok(FeelValue::Float(result))
        }
        (FeelValue::Duration(a), FeelValue::Duration(b)) => {
            let result = match op {
                '-' => a - b,
                _ => return Err(FeelError::TypeError { expected: "number".to_string(), actual: "duration".to_string() }),
            };
            Ok(FeelValue::Duration(result))
        }
        (l, r) => Err(FeelError::TypeError {
            expected: "number".to_string(),
            actual: format!("{} and {}", l.type_name(), r.type_name()),
        }),
    }
}

fn eval_div(l: FeelValue, r: FeelValue) -> Result<FeelValue, FeelError> {
    match (l, r) {
        (FeelValue::Null, _) | (_, FeelValue::Null) => Ok(FeelValue::Null),
        (_, FeelValue::Integer(0)) => Err(FeelError::DivisionByZero),
        (_, FeelValue::Float(f)) if f == 0.0 => Err(FeelError::DivisionByZero),
        (FeelValue::Integer(a), FeelValue::Integer(b)) => {
            // FEEL division returns float
            Ok(FeelValue::Float(a as f64 / b as f64))
        }
        (FeelValue::Float(a), FeelValue::Float(b)) => Ok(FeelValue::Float(a / b)),
        (FeelValue::Integer(a), FeelValue::Float(b)) => Ok(FeelValue::Float(a as f64 / b)),
        (FeelValue::Float(a), FeelValue::Integer(b)) => Ok(FeelValue::Float(a / b as f64)),
        (l, r) => Err(FeelError::TypeError {
            expected: "number".to_string(),
            actual: format!("{} and {}", l.type_name(), r.type_name()),
        }),
    }
}

fn value_in(value: &FeelValue, container: &FeelValue) -> bool {
    match container {
        FeelValue::List(items) => items.iter().any(|item| feel_equals(value, item)),
        FeelValue::Range { .. } => value.in_range(container),
        other => feel_equals(value, other),
    }
}

fn range_to_list(range: &FeelValue) -> Result<Vec<FeelValue>, FeelError> {
    match range {
        FeelValue::Range {
            start,
            end,
            start_inclusive,
            end_inclusive,
        } => {
            match (start.as_ref(), end.as_ref()) {
                (FeelValue::Integer(s), FeelValue::Integer(e)) => {
                    let s = if *start_inclusive { *s } else { *s + 1 };
                    let e = if *end_inclusive { *e } else { *e - 1 };
                    Ok((s..=e).map(FeelValue::Integer).collect())
                }
                _ => Err(FeelError::EvaluationError(
                    "Can only iterate over integer ranges".to_string(),
                )),
            }
        }
        _ => Err(FeelError::EvaluationError("Not a range".to_string())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{evaluate, FeelContext};

    fn ctx() -> FeelContext {
        FeelContext::new()
    }

    fn eval_str(s: &str) -> FeelValue {
        evaluate(s, &ctx()).unwrap()
    }

    fn eval_with(s: &str, ctx: &FeelContext) -> FeelValue {
        evaluate(s, ctx).unwrap()
    }

    #[test]
    fn test_arithmetic() {
        assert_eq!(eval_str("1 + 2"), FeelValue::Integer(3));
        assert_eq!(eval_str("10 - 3"), FeelValue::Integer(7));
        assert_eq!(eval_str("4 * 5"), FeelValue::Integer(20));
        assert_eq!(eval_str("10 / 4"), FeelValue::Float(2.5));
    }

    #[test]
    fn test_comparisons() {
        assert_eq!(eval_str("1 < 2"), FeelValue::Bool(true));
        assert_eq!(eval_str("2 > 1"), FeelValue::Bool(true));
        assert_eq!(eval_str("1 = 1"), FeelValue::Bool(true));
        assert_eq!(eval_str("1 != 2"), FeelValue::Bool(true));
        assert_eq!(eval_str("2 <= 2"), FeelValue::Bool(true));
        assert_eq!(eval_str("3 >= 3"), FeelValue::Bool(true));
    }

    #[test]
    fn test_boolean_logic() {
        assert_eq!(eval_str("true and false"), FeelValue::Bool(false));
        assert_eq!(eval_str("true or false"), FeelValue::Bool(true));
        assert_eq!(eval_str("not true"), FeelValue::Bool(false));
    }

    #[test]
    fn test_string_concat() {
        assert_eq!(
            eval_str(r#""hello" + " " + "world""#),
            FeelValue::String("hello world".to_string())
        );
    }

    #[test]
    fn test_variable_lookup() {
        let mut ctx = FeelContext::new();
        ctx.set("x", FeelValue::Integer(42));
        assert_eq!(eval_with("x", &ctx), FeelValue::Integer(42));
        assert_eq!(eval_with("x > 40", &ctx), FeelValue::Bool(true));
    }

    #[test]
    fn test_if_then_else() {
        assert_eq!(eval_str("if true then 1 else 2"), FeelValue::Integer(1));
        assert_eq!(eval_str("if false then 1 else 2"), FeelValue::Integer(2));
    }

    #[test]
    fn test_list() {
        assert_eq!(
            eval_str("[1, 2, 3]"),
            FeelValue::List(vec![
                FeelValue::Integer(1),
                FeelValue::Integer(2),
                FeelValue::Integer(3)
            ])
        );
    }

    #[test]
    fn test_in_range() {
        assert_eq!(eval_str("5 in [1..10]"), FeelValue::Bool(true));
        assert_eq!(eval_str("15 in [1..10]"), FeelValue::Bool(false));
        assert_eq!(eval_str("1 in [1..10]"), FeelValue::Bool(true));
        assert_eq!(eval_str("1 in (1..10]"), FeelValue::Bool(false));
    }

    #[test]
    fn test_in_list() {
        assert_eq!(eval_str(r#""a" in ["a", "b", "c"]"#), FeelValue::Bool(true));
        assert_eq!(eval_str(r#""d" in ["a", "b", "c"]"#), FeelValue::Bool(false));
    }

    #[test]
    fn test_for_expression() {
        let result = eval_str("for x in [1, 2, 3] return x * 2");
        assert_eq!(
            result,
            FeelValue::List(vec![
                FeelValue::Integer(2),
                FeelValue::Integer(4),
                FeelValue::Integer(6)
            ])
        );
    }

    #[test]
    fn test_some_satisfies() {
        assert_eq!(eval_str("some x in [1, 2, 3] satisfies x > 2"), FeelValue::Bool(true));
        assert_eq!(eval_str("some x in [1, 2, 3] satisfies x > 10"), FeelValue::Bool(false));
    }

    #[test]
    fn test_every_satisfies() {
        assert_eq!(eval_str("every x in [1, 2, 3] satisfies x > 0"), FeelValue::Bool(true));
        assert_eq!(eval_str("every x in [1, 2, 3] satisfies x > 1"), FeelValue::Bool(false));
    }

    #[test]
    fn test_path_expression() {
        let mut ctx = FeelContext::new();
        let mut inner = std::collections::HashMap::new();
        inner.insert("name".to_string(), FeelValue::String("Alice".to_string()));
        ctx.set("person", FeelValue::Context(inner));
        assert_eq!(eval_with("person.name", &ctx), FeelValue::String("Alice".to_string()));
    }

    #[test]
    fn test_null_arithmetic() {
        assert_eq!(eval_str("null + 1"), FeelValue::Null);
        assert_eq!(eval_str("1 + null"), FeelValue::Null);
    }
}
