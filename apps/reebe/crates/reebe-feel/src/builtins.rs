use crate::types::{FeelError, FeelValue};
use std::collections::HashMap;

/// Dispatch to a built-in FEEL function.
pub fn call_builtin(name: &str, args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match name.to_lowercase().as_str() {
        // String functions
        "string length" | "string_length" => builtin_string_length(args),
        "upper case" | "upper_case" => builtin_upper_case(args),
        "lower case" | "lower_case" => builtin_lower_case(args),
        "substring" => builtin_substring(args),
        "contains" => builtin_contains(args),
        "starts with" | "starts_with" => builtin_starts_with(args),
        "ends with" | "ends_with" => builtin_ends_with(args),
        "string join" | "string_join" => builtin_string_join(args),
        "split" => builtin_split(args),
        "trim" => builtin_trim(args),
        "replace" => builtin_replace(args),
        "string" => builtin_string(args),

        // Math functions
        "floor" => builtin_floor(args),
        "ceiling" | "ceil" => builtin_ceiling(args),
        "round up" | "round_up" => builtin_round_up(args),
        "round down" | "round_down" => builtin_round_down(args),
        "abs" => builtin_abs(args),
        "min" => builtin_min(args),
        "max" => builtin_max(args),
        "sum" => builtin_sum(args),
        "mean" => builtin_mean(args),
        "decimal" => builtin_decimal(args),
        "sqrt" => builtin_sqrt(args),
        "log" => builtin_log(args),
        "exp" => builtin_exp(args),
        "odd" => builtin_odd(args),
        "even" => builtin_even(args),
        "modulo" | "mod" => builtin_modulo(args),
        "number" => builtin_number(args),
        "product" => builtin_product(args),
        "median" => builtin_median(args),
        "stddev" => builtin_stddev(args),

        // List functions
        "list contains" | "list_contains" => builtin_list_contains(args),
        "count" => builtin_count(args),
        "flatten" => builtin_flatten(args),
        "append" => builtin_append(args),
        "concatenate" => builtin_concatenate(args),
        "insert before" | "insert_before" => builtin_insert_before(args),
        "remove" => builtin_remove(args),
        "reverse" => builtin_reverse(args),
        "index of" | "index_of" => builtin_index_of(args),
        "union" => builtin_union(args),
        "distinct values" | "distinct_values" => builtin_distinct_values(args),
        "sort" => builtin_sort(args),
        "sublist" => builtin_sublist(args),

        // Date/time functions
        "date" => builtin_date(args),
        "time" => builtin_time(args),
        "date and time" | "date_and_time" => builtin_date_and_time(args),
        "now" => builtin_now(args),
        "today" => builtin_today(args),
        "duration" => builtin_duration(args),
        "years and months duration" | "years_and_months_duration" => builtin_years_and_months_duration(args),

        // Logic functions
        "not" => {
            if args.len() != 1 {
                return Err(FeelError::EvaluationError("not() requires 1 argument".to_string()));
            }
            match &args[0] {
                FeelValue::Bool(b) => Ok(FeelValue::Bool(!b)),
                FeelValue::Null => Ok(FeelValue::Null),
                _ => Err(FeelError::TypeError { expected: "boolean".to_string(), actual: args[0].type_name().to_string() }),
            }
        }
        "all" => builtin_all(args),
        "any" => builtin_any(args),

        // Context functions
        "get value" | "get_value" => builtin_get_value(args),
        "get entries" | "get_entries" => builtin_get_entries(args),
        "put" => builtin_put(args),
        "context merge" | "context_merge" => builtin_context_merge(args),
        "context" => builtin_context(args),

        // Type functions
        "is defined" | "is_defined" => builtin_is_defined(args),
        "get or else" | "get_or_else" => builtin_get_or_else(args),

        // Camunda extension: tags a value as supplied by an AI agent and returns it.
        "fromai" => Ok(args.into_iter().next().unwrap_or(FeelValue::Null)),

        name => Err(FeelError::UndefinedFunction(name.to_string())),
    }
}

// ---- String functions ----

fn builtin_string_length(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::String(s)) => Ok(FeelValue::Integer(s.chars().count() as i64)),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("string length() requires 1 argument".to_string())),
    }
}

fn builtin_upper_case(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::String(s)) => Ok(FeelValue::String(s.to_uppercase())),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("upper case() requires 1 argument".to_string())),
    }
}

fn builtin_lower_case(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::String(s)) => Ok(FeelValue::String(s.to_lowercase())),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("lower case() requires 1 argument".to_string())),
    }
}

fn builtin_substring(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::Integer(start)] => {
            let start = if *start < 0 {
                (s.chars().count() as i64 + start).max(0) as usize
            } else {
                (start - 1).max(0) as usize
            };
            let result: String = s.chars().skip(start).collect();
            Ok(FeelValue::String(result))
        }
        [FeelValue::String(s), FeelValue::Integer(start), FeelValue::Integer(length)] => {
            let len = s.chars().count() as i64;
            let start = if *start < 0 {
                (len + start).max(0) as usize
            } else {
                (start - 1).max(0) as usize
            };
            let length = (*length).max(0) as usize;
            let result: String = s.chars().skip(start).take(length).collect();
            Ok(FeelValue::String(result))
        }
        _ => Err(FeelError::EvaluationError("substring() requires 2 or 3 arguments: (string, start) or (string, start, length)".to_string())),
    }
}

fn builtin_contains(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::String(substr)] => {
            Ok(FeelValue::Bool(s.contains(substr.as_str())))
        }
        [FeelValue::Null, _] | [_, FeelValue::Null] => Ok(FeelValue::Null),
        _ => Err(FeelError::EvaluationError("contains() requires (string, string)".to_string())),
    }
}

fn builtin_starts_with(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::String(prefix)] => {
            Ok(FeelValue::Bool(s.starts_with(prefix.as_str())))
        }
        [FeelValue::Null, _] | [_, FeelValue::Null] => Ok(FeelValue::Null),
        _ => Err(FeelError::EvaluationError("starts with() requires (string, string)".to_string())),
    }
}

fn builtin_ends_with(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::String(suffix)] => {
            Ok(FeelValue::Bool(s.ends_with(suffix.as_str())))
        }
        [FeelValue::Null, _] | [_, FeelValue::Null] => Ok(FeelValue::Null),
        _ => Err(FeelError::EvaluationError("ends with() requires (string, string)".to_string())),
    }
}

fn builtin_string_join(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(items)] => {
            let parts: Result<Vec<String>, _> = items.iter().map(|v| match v {
                FeelValue::String(s) => Ok(s.clone()),
                _ => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
            }).collect();
            Ok(FeelValue::String(parts?.join("")))
        }
        [FeelValue::List(items), FeelValue::String(sep)] => {
            let parts: Result<Vec<String>, _> = items.iter().map(|v| match v {
                FeelValue::String(s) => Ok(s.clone()),
                _ => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
            }).collect();
            Ok(FeelValue::String(parts?.join(sep.as_str())))
        }
        _ => Err(FeelError::EvaluationError("string join() requires (list) or (list, separator)".to_string())),
    }
}

fn builtin_split(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::String(sep)] => {
            let parts: Vec<FeelValue> = s.split(sep.as_str()).map(|p| FeelValue::String(p.to_string())).collect();
            Ok(FeelValue::List(parts))
        }
        _ => Err(FeelError::EvaluationError("split() requires (string, delimiter)".to_string())),
    }
}

fn builtin_trim(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::String(s)) => Ok(FeelValue::String(s.trim().to_string())),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "string".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("trim() requires 1 argument".to_string())),
    }
}

fn builtin_replace(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s), FeelValue::String(pattern), FeelValue::String(replacement)] => {
            Ok(FeelValue::String(s.replace(pattern.as_str(), replacement.as_str())))
        }
        _ => Err(FeelError::EvaluationError("replace() requires (string, pattern, replacement)".to_string())),
    }
}

fn builtin_string(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(v) => Ok(FeelValue::String(v.to_string())),
        None => Err(FeelError::EvaluationError("string() requires 1 argument".to_string())),
    }
}

// ---- Math functions ----

fn builtin_floor(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Integer(n)) => Ok(FeelValue::Integer(n)),
        Some(FeelValue::Float(f)) => Ok(FeelValue::Integer(f.floor() as i64)),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("floor() requires 1 argument".to_string())),
    }
}

fn builtin_ceiling(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Integer(n)) => Ok(FeelValue::Integer(n)),
        Some(FeelValue::Float(f)) => Ok(FeelValue::Integer(f.ceil() as i64)),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("ceiling() requires 1 argument".to_string())),
    }
}

fn builtin_round_up(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Float(f), FeelValue::Integer(scale)] => {
            let factor = 10f64.powi(*scale as i32);
            let result = (f * factor).ceil() / factor;
            Ok(FeelValue::Float(result))
        }
        [FeelValue::Integer(n), _] => Ok(FeelValue::Integer(*n)),
        _ => Err(FeelError::EvaluationError("round up() requires (number, scale)".to_string())),
    }
}

fn builtin_round_down(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Float(f), FeelValue::Integer(scale)] => {
            let factor = 10f64.powi(*scale as i32);
            let result = (f * factor).floor() / factor;
            Ok(FeelValue::Float(result))
        }
        [FeelValue::Integer(n), _] => Ok(FeelValue::Integer(*n)),
        _ => Err(FeelError::EvaluationError("round down() requires (number, scale)".to_string())),
    }
}

fn builtin_abs(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Integer(n)) => Ok(FeelValue::Integer(n.abs())),
        Some(FeelValue::Float(f)) => Ok(FeelValue::Float(f.abs())),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("abs() requires 1 argument".to_string())),
    }
}

fn numeric_list(args: Vec<FeelValue>) -> Result<Vec<f64>, FeelError> {
    // Handle either a single list argument or varargs
    let items = if args.len() == 1 {
        match args.into_iter().next().unwrap() {
            FeelValue::List(items) => items,
            v => vec![v],
        }
    } else {
        args
    };

    items.into_iter().map(|v| {
        v.as_number_f64().ok_or_else(|| FeelError::TypeError {
            expected: "number".to_string(),
            actual: v.type_name().to_string(),
        })
    }).collect()
}

fn builtin_min(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    nums.into_iter().reduce(f64::min)
        .map(|v| if v == v.floor() && v.abs() < i64::MAX as f64 { FeelValue::Integer(v as i64) } else { FeelValue::Float(v) })
        .ok_or_else(|| FeelError::EvaluationError("min() requires at least one number".to_string()))
}

fn builtin_max(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    nums.into_iter().reduce(f64::max)
        .map(|v| if v == v.floor() && v.abs() < i64::MAX as f64 { FeelValue::Integer(v as i64) } else { FeelValue::Float(v) })
        .ok_or_else(|| FeelError::EvaluationError("max() requires at least one number".to_string()))
}

fn builtin_sum(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    let s: f64 = nums.iter().sum();
    if s == s.floor() && s.abs() < i64::MAX as f64 {
        Ok(FeelValue::Integer(s as i64))
    } else {
        Ok(FeelValue::Float(s))
    }
}

fn builtin_mean(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    if nums.is_empty() {
        return Ok(FeelValue::Null);
    }
    let s: f64 = nums.iter().sum();
    Ok(FeelValue::Float(s / nums.len() as f64))
}

fn builtin_decimal(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [n, FeelValue::Integer(scale)] => {
            let f = n.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: n.type_name().to_string() })?;
            let factor = 10f64.powi(*scale as i32);
            Ok(FeelValue::Float((f * factor).round() / factor))
        }
        _ => Err(FeelError::EvaluationError("decimal() requires (number, scale)".to_string())),
    }
}

fn builtin_sqrt(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(v) => {
            let f = v.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() })?;
            Ok(FeelValue::Float(f.sqrt()))
        }
        None => Err(FeelError::EvaluationError("sqrt() requires 1 argument".to_string())),
    }
}

fn builtin_log(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(v) => {
            let f = v.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() })?;
            Ok(FeelValue::Float(f.ln()))
        }
        None => Err(FeelError::EvaluationError("log() requires 1 argument".to_string())),
    }
}

fn builtin_exp(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(v) => {
            let f = v.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: v.type_name().to_string() })?;
            Ok(FeelValue::Float(f.exp()))
        }
        None => Err(FeelError::EvaluationError("exp() requires 1 argument".to_string())),
    }
}

fn builtin_odd(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Integer(n)) => Ok(FeelValue::Bool(n % 2 != 0)),
        Some(v) => Err(FeelError::TypeError { expected: "integer".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("odd() requires 1 argument".to_string())),
    }
}

fn builtin_even(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Integer(n)) => Ok(FeelValue::Bool(n % 2 == 0)),
        Some(v) => Err(FeelError::TypeError { expected: "integer".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("even() requires 1 argument".to_string())),
    }
}

fn builtin_modulo(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Integer(a), FeelValue::Integer(b)] => {
            if *b == 0 { return Err(FeelError::DivisionByZero); }
            Ok(FeelValue::Integer(a % b))
        }
        [a, b] => {
            let a = a.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: a.type_name().to_string() })?;
            let b = b.as_number_f64().ok_or_else(|| FeelError::TypeError { expected: "number".to_string(), actual: b.type_name().to_string() })?;
            if b == 0.0 { return Err(FeelError::DivisionByZero); }
            Ok(FeelValue::Float(a % b))
        }
        _ => Err(FeelError::EvaluationError("modulo() requires 2 arguments".to_string())),
    }
}

fn builtin_number(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::String(s)) => {
            if let Ok(i) = s.parse::<i64>() {
                Ok(FeelValue::Integer(i))
            } else if let Ok(f) = s.parse::<f64>() {
                Ok(FeelValue::Float(f))
            } else {
                Err(FeelError::EvaluationError(format!("Cannot convert '{}' to number", s)))
            }
        }
        Some(v @ FeelValue::Integer(_)) | Some(v @ FeelValue::Float(_)) => Ok(v),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "string or number".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("number() requires 1 argument".to_string())),
    }
}

fn builtin_product(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    let p: f64 = nums.iter().product();
    if p == p.floor() && p.abs() < i64::MAX as f64 {
        Ok(FeelValue::Integer(p as i64))
    } else {
        Ok(FeelValue::Float(p))
    }
}

fn builtin_median(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let mut nums = numeric_list(args)?;
    if nums.is_empty() { return Ok(FeelValue::Null); }
    nums.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let mid = nums.len() / 2;
    if nums.len() % 2 == 0 {
        Ok(FeelValue::Float((nums[mid - 1] + nums[mid]) / 2.0))
    } else {
        Ok(FeelValue::Float(nums[mid]))
    }
}

fn builtin_stddev(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let nums = numeric_list(args)?;
    if nums.is_empty() { return Ok(FeelValue::Null); }
    let mean = nums.iter().sum::<f64>() / nums.len() as f64;
    let variance = nums.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / nums.len() as f64;
    Ok(FeelValue::Float(variance.sqrt()))
}

// ---- List functions ----

fn builtin_list_contains(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(list), item] => {
            Ok(FeelValue::Bool(list.iter().any(|v| v == item)))
        }
        _ => Err(FeelError::EvaluationError("list contains() requires (list, item)".to_string())),
    }
}

fn builtin_count(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::List(items)) => Ok(FeelValue::Integer(items.len() as i64)),
        Some(FeelValue::Null) => Ok(FeelValue::Null),
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("count() requires 1 argument".to_string())),
    }
}

fn builtin_flatten(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::List(items)) => {
            let mut result = Vec::new();
            flatten_list(items, &mut result);
            Ok(FeelValue::List(result))
        }
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("flatten() requires 1 argument".to_string())),
    }
}

fn flatten_list(items: Vec<FeelValue>, result: &mut Vec<FeelValue>) {
    for item in items {
        match item {
            FeelValue::List(inner) => flatten_list(inner, result),
            v => result.push(v),
        }
    }
}

fn builtin_append(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    if args.len() < 2 {
        return Err(FeelError::EvaluationError("append() requires (list, item...)".to_string()));
    }
    let mut args = args.into_iter();
    match args.next().unwrap() {
        FeelValue::List(mut list) => {
            for item in args {
                list.push(item);
            }
            Ok(FeelValue::List(list))
        }
        v => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
    }
}

fn builtin_concatenate(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            FeelValue::List(items) => result.extend(items),
            v => result.push(v),
        }
    }
    Ok(FeelValue::List(result))
}

fn builtin_insert_before(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(list), FeelValue::Integer(pos), item] => {
            let mut new_list = list.clone();
            let idx = if *pos < 0 {
                ((list.len() as i64) + pos + 1).max(0) as usize
            } else {
                (*pos - 1).max(0) as usize
            };
            new_list.insert(idx.min(new_list.len()), item.clone());
            Ok(FeelValue::List(new_list))
        }
        _ => Err(FeelError::EvaluationError("insert before() requires (list, position, item)".to_string())),
    }
}

fn builtin_remove(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(list), FeelValue::Integer(pos)] => {
            let mut new_list = list.clone();
            let idx = if *pos < 0 {
                ((list.len() as i64) + pos) as usize
            } else {
                (*pos - 1) as usize
            };
            if idx < new_list.len() {
                new_list.remove(idx);
            }
            Ok(FeelValue::List(new_list))
        }
        _ => Err(FeelError::EvaluationError("remove() requires (list, position)".to_string())),
    }
}

fn builtin_reverse(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::List(mut items)) => {
            items.reverse();
            Ok(FeelValue::List(items))
        }
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("reverse() requires 1 argument".to_string())),
    }
}

fn builtin_index_of(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(list), item] => {
            let indices: Vec<FeelValue> = list.iter().enumerate()
                .filter(|(_, v)| *v == item)
                .map(|(i, _)| FeelValue::Integer((i + 1) as i64))
                .collect();
            Ok(FeelValue::List(indices))
        }
        _ => Err(FeelError::EvaluationError("index of() requires (list, item)".to_string())),
    }
}

fn builtin_union(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let mut result = Vec::new();
    for arg in args {
        match arg {
            FeelValue::List(items) => {
                for item in items {
                    if !result.contains(&item) {
                        result.push(item);
                    }
                }
            }
            _ => {}
        }
    }
    Ok(FeelValue::List(result))
}

fn builtin_distinct_values(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::List(items)) => {
            let mut seen = Vec::new();
            for item in items {
                if !seen.contains(&item) {
                    seen.push(item);
                }
            }
            Ok(FeelValue::List(seen))
        }
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("distinct values() requires 1 argument".to_string())),
    }
}

fn builtin_sort(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::List(mut items)) => {
            items.sort_by(|a, b| {
                crate::types::compare_values(a, b).unwrap_or(std::cmp::Ordering::Equal)
            });
            Ok(FeelValue::List(items))
        }
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("sort() requires 1 argument".to_string())),
    }
}

fn builtin_sublist(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::List(list), FeelValue::Integer(start)] => {
            let start = if *start < 0 {
                ((list.len() as i64) + start).max(0) as usize
            } else {
                (*start - 1).max(0) as usize
            };
            Ok(FeelValue::List(list[start..].to_vec()))
        }
        [FeelValue::List(list), FeelValue::Integer(start), FeelValue::Integer(length)] => {
            let start = if *start < 0 {
                ((list.len() as i64) + start).max(0) as usize
            } else {
                (*start - 1).max(0) as usize
            };
            let length = (*length).max(0) as usize;
            Ok(FeelValue::List(list[start..].iter().take(length).cloned().collect()))
        }
        _ => Err(FeelError::EvaluationError("sublist() requires (list, start) or (list, start, length)".to_string())),
    }
}

// ---- Date/time functions ----

fn builtin_date(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s)] => {
            chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d")
                .map(FeelValue::Date)
                .map_err(|e| FeelError::EvaluationError(format!("Invalid date '{}': {}", s, e)))
        }
        [FeelValue::Integer(year), FeelValue::Integer(month), FeelValue::Integer(day)] => {
            chrono::NaiveDate::from_ymd_opt(*year as i32, *month as u32, *day as u32)
                .map(FeelValue::Date)
                .ok_or_else(|| FeelError::EvaluationError(format!("Invalid date: {}-{}-{}", year, month, day)))
        }
        _ => Err(FeelError::EvaluationError("date() requires (string) or (year, month, day)".to_string())),
    }
}

fn builtin_time(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s)] => {
            // Try various formats
            let formats = ["%H:%M:%S", "%H:%M:%S%.f", "%H:%M"];
            for fmt in &formats {
                if let Ok(t) = chrono::NaiveTime::parse_from_str(s.trim_end_matches('Z'), fmt) {
                    return Ok(FeelValue::Time(t));
                }
            }
            Err(FeelError::EvaluationError(format!("Invalid time '{}'", s)))
        }
        _ => Err(FeelError::EvaluationError("time() requires a string argument".to_string())),
    }
}

fn builtin_date_and_time(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s)] => {
            // Try parsing as RFC3339 or ISO 8601
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(s) {
                return Ok(FeelValue::DateTime(dt.with_timezone(&chrono::Utc)));
            }
            // Try without timezone
            if let Ok(dt) = chrono::NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") {
                return Ok(FeelValue::DateTime(chrono::DateTime::from_naive_utc_and_offset(dt, chrono::Utc)));
            }
            Err(FeelError::EvaluationError(format!("Invalid date and time '{}'", s)))
        }
        [FeelValue::Date(d), FeelValue::Time(t)] => {
            let dt = d.and_time(*t);
            Ok(FeelValue::DateTime(chrono::DateTime::from_naive_utc_and_offset(dt, chrono::Utc)))
        }
        _ => Err(FeelError::EvaluationError("date and time() requires (string) or (date, time)".to_string())),
    }
}

fn builtin_now(_args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    Ok(FeelValue::DateTime(chrono::Utc::now()))
}

fn builtin_today(_args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    Ok(FeelValue::Date(chrono::Utc::now().date_naive()))
}

fn builtin_duration(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::String(s)] => parse_iso_duration(s),
        _ => Err(FeelError::EvaluationError("duration() requires a string argument".to_string())),
    }
}

fn parse_iso_duration(s: &str) -> Result<FeelValue, FeelError> {
    // Parse ISO 8601 duration like PT1H, P1D, P1Y2M3DT4H5M6S
    let s = s.trim();
    if !s.starts_with('P') {
        return Err(FeelError::EvaluationError(format!("Invalid duration '{}': must start with P", s)));
    }
    let s = &s[1..]; // skip P
    let mut total_ms = 0i64;
    let (date_part, time_part) = if let Some(pos) = s.find('T') {
        (&s[..pos], &s[pos + 1..])
    } else {
        (s, "")
    };

    // Parse date part: Y, M, W, D
    let mut num_str = String::new();
    for ch in date_part.chars() {
        if ch.is_ascii_digit() {
            num_str.push(ch);
        } else {
            let n: i64 = num_str.parse().unwrap_or(0);
            num_str.clear();
            match ch {
                'Y' => total_ms += n * 365 * 24 * 3600 * 1000,
                'M' => total_ms += n * 30 * 24 * 3600 * 1000,
                'W' => total_ms += n * 7 * 24 * 3600 * 1000,
                'D' => total_ms += n * 24 * 3600 * 1000,
                _ => {}
            }
        }
    }

    // Parse time part: H, M, S
    for ch in time_part.chars() {
        if ch.is_ascii_digit() || ch == '.' {
            num_str.push(ch);
        } else {
            let n: f64 = num_str.parse().unwrap_or(0.0);
            num_str.clear();
            match ch {
                'H' => total_ms += (n * 3600.0 * 1000.0) as i64,
                'M' => total_ms += (n * 60.0 * 1000.0) as i64,
                'S' => total_ms += (n * 1000.0) as i64,
                _ => {}
            }
        }
    }

    Ok(FeelValue::Duration(total_ms))
}

fn builtin_years_and_months_duration(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    use chrono::Datelike;
    match args.as_slice() {
        [FeelValue::Date(from), FeelValue::Date(to)] => {
            let months = (to.year() as i64 - from.year() as i64) * 12
                + (to.month() as i64 - from.month() as i64);
            // Represent years and months as approximate ms
            Ok(FeelValue::Duration(months * 30 * 24 * 3600 * 1000))
        }
        _ => Err(FeelError::EvaluationError("years and months duration() requires (date, date)".to_string())),
    }
}

// ---- Logic functions ----

fn builtin_all(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let items = match args.as_slice() {
        [FeelValue::List(items)] => items.clone(),
        _ => args,
    };
    for item in &items {
        match item {
            FeelValue::Bool(false) => return Ok(FeelValue::Bool(false)),
            FeelValue::Null => {} // keep checking
            _ => {}
        }
    }
    // If any were null, return null; otherwise true
    if items.iter().any(|v| matches!(v, FeelValue::Null)) {
        Ok(FeelValue::Null)
    } else {
        Ok(FeelValue::Bool(true))
    }
}

fn builtin_any(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let items = match args.as_slice() {
        [FeelValue::List(items)] => items.clone(),
        _ => args,
    };
    for item in &items {
        if matches!(item, FeelValue::Bool(true)) {
            return Ok(FeelValue::Bool(true));
        }
    }
    if items.iter().any(|v| matches!(v, FeelValue::Null)) {
        Ok(FeelValue::Null)
    } else {
        Ok(FeelValue::Bool(false))
    }
}

// ---- Context functions ----

fn builtin_get_value(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Context(map), FeelValue::String(key)] => {
            Ok(map.get(key).cloned().unwrap_or(FeelValue::Null))
        }
        _ => Err(FeelError::EvaluationError("get value() requires (context, key)".to_string())),
    }
}

fn builtin_get_entries(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Context(map)) => {
            let entries: Vec<FeelValue> = map.into_iter().map(|(k, v)| {
                let mut entry = HashMap::new();
                entry.insert("key".to_string(), FeelValue::String(k));
                entry.insert("value".to_string(), v);
                FeelValue::Context(entry)
            }).collect();
            Ok(FeelValue::List(entries))
        }
        Some(v) => Err(FeelError::TypeError { expected: "context".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("get entries() requires 1 argument".to_string())),
    }
}

fn builtin_put(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Context(map), FeelValue::String(key), value] => {
            let mut new_map = map.clone();
            new_map.insert(key.clone(), value.clone());
            Ok(FeelValue::Context(new_map))
        }
        _ => Err(FeelError::EvaluationError("put() requires (context, key, value)".to_string())),
    }
}

fn builtin_context_merge(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    let mut merged = HashMap::new();
    for arg in args {
        match arg {
            FeelValue::Context(map) => merged.extend(map),
            FeelValue::List(items) => {
                for item in items {
                    if let FeelValue::Context(map) = item {
                        merged.extend(map);
                    }
                }
            }
            _ => {}
        }
    }
    Ok(FeelValue::Context(merged))
}

fn builtin_context(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    // context(list of {key, value} entries)
    match args.into_iter().next() {
        Some(FeelValue::List(entries)) => {
            let mut map = HashMap::new();
            for entry in entries {
                if let FeelValue::Context(e) = entry {
                    let key = e.get("key").and_then(|v| if let FeelValue::String(s) = v { Some(s.clone()) } else { None });
                    let value = e.get("value").cloned();
                    if let (Some(k), Some(v)) = (key, value) {
                        map.insert(k, v);
                    }
                }
            }
            Ok(FeelValue::Context(map))
        }
        Some(v) => Err(FeelError::TypeError { expected: "list".to_string(), actual: v.type_name().to_string() }),
        None => Err(FeelError::EvaluationError("context() requires 1 argument".to_string())),
    }
}

// ---- Type functions ----

fn builtin_is_defined(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.into_iter().next() {
        Some(FeelValue::Null) => Ok(FeelValue::Bool(false)),
        Some(_) => Ok(FeelValue::Bool(true)),
        None => Err(FeelError::EvaluationError("is defined() requires 1 argument".to_string())),
    }
}

fn builtin_get_or_else(args: Vec<FeelValue>) -> Result<FeelValue, FeelError> {
    match args.as_slice() {
        [FeelValue::Null, default] => Ok(default.clone()),
        [value, _] => Ok(value.clone()),
        _ => Err(FeelError::EvaluationError("get or else() requires (value, default)".to_string())),
    }
}

#[cfg(test)]
mod tests {
    use crate::{evaluate, FeelContext};
    use crate::types::FeelValue;

    fn eval(s: &str) -> FeelValue {
        evaluate(s, &FeelContext::new()).unwrap()
    }

    #[test]
    fn test_string_length() {
        assert_eq!(eval(r#"string length("hello")"#), FeelValue::Integer(5));
    }

    #[test]
    fn test_upper_lower_case() {
        assert_eq!(eval(r#"upper case("hello")"#), FeelValue::String("HELLO".to_string()));
        assert_eq!(eval(r#"lower case("WORLD")"#), FeelValue::String("world".to_string()));
    }

    #[test]
    fn test_contains() {
        assert_eq!(eval(r#"contains("hello world", "world")"#), FeelValue::Bool(true));
        assert_eq!(eval(r#"contains("hello", "world")"#), FeelValue::Bool(false));
    }

    #[test]
    fn test_starts_ends_with() {
        assert_eq!(eval(r#"starts with("hello", "hel")"#), FeelValue::Bool(true));
        assert_eq!(eval(r#"ends with("hello", "llo")"#), FeelValue::Bool(true));
    }

    #[test]
    fn test_substring() {
        assert_eq!(eval(r#"substring("hello", 2, 3)"#), FeelValue::String("ell".to_string()));
    }

    #[test]
    fn test_floor_ceiling() {
        assert_eq!(eval("floor(3.7)"), FeelValue::Integer(3));
        assert_eq!(eval("ceiling(3.2)"), FeelValue::Integer(4));
    }

    #[test]
    fn test_abs() {
        assert_eq!(eval("abs(-5)"), FeelValue::Integer(5));
    }

    #[test]
    fn test_min_max() {
        assert_eq!(eval("min([1, 2, 3])"), FeelValue::Integer(1));
        assert_eq!(eval("max([1, 2, 3])"), FeelValue::Integer(3));
    }

    #[test]
    fn test_sum() {
        assert_eq!(eval("sum([1, 2, 3])"), FeelValue::Integer(6));
    }

    #[test]
    fn test_count() {
        assert_eq!(eval("count([1, 2, 3])"), FeelValue::Integer(3));
    }

    #[test]
    fn test_list_contains() {
        assert_eq!(eval("list contains([1, 2, 3], 2)"), FeelValue::Bool(true));
        assert_eq!(eval("list contains([1, 2, 3], 5)"), FeelValue::Bool(false));
    }

    #[test]
    fn test_reverse() {
        assert_eq!(
            eval("reverse([1, 2, 3])"),
            FeelValue::List(vec![FeelValue::Integer(3), FeelValue::Integer(2), FeelValue::Integer(1)])
        );
    }

    #[test]
    fn test_append() {
        assert_eq!(
            eval("append([1, 2], 3)"),
            FeelValue::List(vec![FeelValue::Integer(1), FeelValue::Integer(2), FeelValue::Integer(3)])
        );
    }

    #[test]
    fn test_flatten() {
        assert_eq!(
            eval("flatten([[1, 2], [3, 4]])"),
            FeelValue::List(vec![FeelValue::Integer(1), FeelValue::Integer(2), FeelValue::Integer(3), FeelValue::Integer(4)])
        );
    }

    #[test]
    fn test_distinct_values() {
        assert_eq!(
            eval("distinct values([1, 2, 1, 3, 2])"),
            FeelValue::List(vec![FeelValue::Integer(1), FeelValue::Integer(2), FeelValue::Integer(3)])
        );
    }

    #[test]
    fn test_is_defined() {
        assert_eq!(eval("is defined(null)"), FeelValue::Bool(false));
        assert_eq!(eval("is defined(1)"), FeelValue::Bool(true));
    }

    #[test]
    fn test_get_or_else() {
        assert_eq!(eval("get or else(null, 42)"), FeelValue::Integer(42));
        assert_eq!(eval("get or else(10, 42)"), FeelValue::Integer(10));
    }

    #[test]
    fn test_odd_even() {
        assert_eq!(eval("odd(3)"), FeelValue::Bool(true));
        assert_eq!(eval("even(4)"), FeelValue::Bool(true));
    }

    #[test]
    fn test_not_function() {
        assert_eq!(eval("not(true)"), FeelValue::Bool(false));
    }
}
