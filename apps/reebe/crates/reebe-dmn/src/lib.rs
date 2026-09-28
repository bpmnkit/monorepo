//! DMN 1.3 decision evaluator for the Reebe workflow engine.

use quick_xml::events::Event;
use quick_xml::Reader;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum DmnError {
    #[error("DMN parse error: {0}")]
    ParseError(String),

    #[error("Decision '{0}' not found")]
    DecisionNotFound(String),

    #[error("Decision evaluation error: {0}")]
    EvaluationError(String),
}

/// A parsed DMN decision requirements graph.
#[derive(Debug, Clone)]
pub struct DmnDecisionRequirementsGraph {
    pub id: String,
    pub name: String,
    pub namespace: Option<String>,
    pub decisions: Vec<DmnDecision>,
}

/// A single DMN decision.
#[derive(Debug, Clone)]
pub struct DmnDecision {
    pub id: String,
    pub name: String,
    pub kind: DecisionKind,
}

/// The kind of DMN decision.
#[derive(Debug, Clone)]
pub enum DecisionKind {
    DecisionTable(DecisionTable),
    LiteralExpression(String),
}

/// A decision table within a decision.
#[derive(Debug, Clone)]
pub struct DecisionTable {
    pub hit_policy: HitPolicy,
    pub inputs: Vec<DecisionInput>,
    pub outputs: Vec<DecisionOutput>,
    pub rules: Vec<DecisionRule>,
}

/// Hit policy for a decision table.
#[derive(Debug, Clone, PartialEq)]
pub enum HitPolicy {
    /// UNIQUE — only one rule may match (default)
    Unique,
    /// FIRST — first matching rule wins
    First,
    /// ANY — all matching rules must have identical output
    Any,
    /// COLLECT — all matching rules are returned as an array
    Collect,
    /// RULE ORDER — matching rules in rule-definition order
    RuleOrder,
    /// OUTPUT ORDER — matching rules ordered by output priority list
    OutputOrder,
}

impl Default for HitPolicy {
    fn default() -> Self {
        HitPolicy::Unique
    }
}

/// An input column of a decision table.
#[derive(Debug, Clone)]
pub struct DecisionInput {
    pub id: String,
    pub label: Option<String>,
    /// FEEL expression for the input (e.g. "amount")
    pub expression: String,
    pub type_ref: Option<String>,
}

/// An output column of a decision table.
#[derive(Debug, Clone)]
pub struct DecisionOutput {
    pub id: String,
    pub name: String,
    pub type_ref: Option<String>,
}

/// A single rule (row) in a decision table.
#[derive(Debug, Clone)]
pub struct DecisionRule {
    pub id: String,
    /// FEEL unary tests per input column (empty / "-" means any)
    pub input_entries: Vec<String>,
    /// FEEL expressions per output column
    pub output_entries: Vec<String>,
    pub description: Option<String>,
}

// ────────────────────────────────────────────────────────────────
// Parser
// ────────────────────────────────────────────────────────────────

/// Parse a DMN 1.3 XML string into a `DmnDecisionRequirementsGraph`.
pub fn parse_dmn(xml: &str) -> Result<DmnDecisionRequirementsGraph, DmnError> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut drg = DmnDecisionRequirementsGraph {
        id: String::new(),
        name: String::new(),
        namespace: None,
        decisions: Vec::new(),
    };

    // Parser state
    let mut current_decision: Option<DmnDecision> = None;
    let mut current_table: Option<DecisionTable> = None;
    let mut current_input: Option<DecisionInput> = None;
    let mut current_rule: Option<DecisionRule> = None;
    // Which entry inside a rule we are collecting text for
    enum EntryKind {
        Input,
        Output,
    }
    let mut current_entry_kind: Option<EntryKind> = None;
    let mut literal_expr_text: Option<String> = None;
    // Are we currently inside an inputExpression > text element?
    let mut in_input_expression: bool = false;
    let mut in_literal_expression: bool = false;

    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Err(e) => return Err(DmnError::ParseError(e.to_string())),
            Ok(Event::Eof) => break,

            Ok(Event::Start(ref e)) => {
                let name_bytes = e.name();
                let local_name = local_name_of(name_bytes.as_ref());

                match local_name {
                    "definitions" => {
                        drg.id = attr_value(e, "id").unwrap_or_default();
                        drg.name = attr_value(e, "name").unwrap_or_default();
                        drg.namespace = attr_value(e, "namespace");
                    }
                    "decision" => {
                        let id = attr_value(e, "id").unwrap_or_default();
                        let name = attr_value(e, "name").unwrap_or_default();
                        current_decision = Some(DmnDecision {
                            id,
                            name,
                            kind: DecisionKind::LiteralExpression(String::new()),
                        });
                    }
                    "decisionTable" => {
                        let hp = attr_value(e, "hitPolicy")
                            .as_deref()
                            .map(parse_hit_policy)
                            .unwrap_or_default();
                        current_table = Some(DecisionTable {
                            hit_policy: hp,
                            inputs: Vec::new(),
                            outputs: Vec::new(),
                            rules: Vec::new(),
                        });
                    }
                    "input" => {
                        // Only start a new input if we're not inside a rule
                        if current_rule.is_none() {
                            let id = attr_value(e, "id").unwrap_or_default();
                            let label = attr_value(e, "label");
                            current_input = Some(DecisionInput {
                                id,
                                label,
                                expression: String::new(),
                                type_ref: None,
                            });
                        }
                    }
                    "inputExpression" => {
                        if let Some(ref mut inp) = current_input {
                            inp.type_ref = attr_value(e, "typeRef");
                        }
                        in_input_expression = true;
                    }
                    "rule" => {
                        let id = attr_value(e, "id").unwrap_or_default();
                        current_rule = Some(DecisionRule {
                            id,
                            input_entries: Vec::new(),
                            output_entries: Vec::new(),
                            description: None,
                        });
                    }
                    "inputEntry" => {
                        current_entry_kind = Some(EntryKind::Input);
                    }
                    "outputEntry" => {
                        current_entry_kind = Some(EntryKind::Output);
                    }
                    "literalExpression" => {
                        literal_expr_text = Some(String::new());
                        in_literal_expression = true;
                    }
                    _ => {}
                }
            }

            Ok(Event::Empty(ref e)) => {
                let name_bytes = e.name();
                let local_name = local_name_of(name_bytes.as_ref());

                match local_name {
                    "output" => {
                        // Self-closing output element (column definition)
                        if current_rule.is_none() {
                            let id = attr_value(e, "id").unwrap_or_default();
                            let name = attr_value(e, "name").unwrap_or_default();
                            let type_ref = attr_value(e, "typeRef");
                            if let Some(ref mut tbl) = current_table {
                                tbl.outputs.push(DecisionOutput { id, name, type_ref });
                            }
                        }
                    }
                    "inputEntry" => {
                        // Empty input entry means "any" (wildcard)
                        if let Some(ref mut rule) = current_rule {
                            rule.input_entries.push("-".to_string());
                        }
                    }
                    "outputEntry" => {
                        // Empty output entry
                        if let Some(ref mut rule) = current_rule {
                            rule.output_entries.push(String::new());
                        }
                    }
                    _ => {}
                }
            }

            Ok(Event::Text(ref e)) => {
                let text = e
                    .unescape()
                    .map_err(|e| DmnError::ParseError(e.to_string()))?
                    .to_string();
                let trimmed = text.trim().to_string();

                if trimmed.is_empty() {
                    buf.clear();
                    continue;
                }

                // inputExpression > text  (we're inside an <input> column, inside <inputExpression>)
                if in_input_expression {
                    if let Some(ref mut inp) = current_input {
                        if inp.expression.is_empty() {
                            inp.expression = trimmed.clone();
                        }
                    }
                }

                // literalExpression > text
                if in_literal_expression {
                    if let Some(ref mut le) = literal_expr_text {
                        if le.is_empty() {
                            *le = trimmed.clone();
                        }
                    }
                }

                // rule entries (inputEntry/outputEntry > text)
                if let Some(ref kind) = current_entry_kind {
                    if let Some(ref mut rule) = current_rule {
                        match kind {
                            EntryKind::Input => rule.input_entries.push(trimmed),
                            EntryKind::Output => rule.output_entries.push(trimmed),
                        }
                    }
                    current_entry_kind = None;
                }
            }

            Ok(Event::End(ref e)) => {
                let name_bytes = e.name();
                let local_name = local_name_of(name_bytes.as_ref());

                match local_name {
                    "inputExpression" => {
                        in_input_expression = false;
                    }
                    "literalExpression" => {
                        in_literal_expression = false;
                        if let (Some(expr_text), Some(ref mut dec)) =
                            (literal_expr_text.take(), current_decision.as_mut())
                        {
                            dec.kind = DecisionKind::LiteralExpression(expr_text);
                        }
                    }
                    "input" => {
                        // Closing the column-level <input> (not inside a rule)
                        if current_rule.is_none() {
                            if let (Some(inp), Some(ref mut tbl)) =
                                (current_input.take(), current_table.as_mut())
                            {
                                tbl.inputs.push(inp);
                            }
                        }
                    }
                    "output" => {
                        // Non-empty output column element (rare, but handle it)
                        // Typically output is self-closing, handled in Empty above.
                    }
                    "inputEntry" | "outputEntry" => {
                        // If the entry had no text content, insert a wildcard/empty value
                        if current_entry_kind.is_some() {
                            let kind = current_entry_kind.take().unwrap();
                            if let Some(ref mut rule) = current_rule {
                                match kind {
                                    EntryKind::Input => rule.input_entries.push("-".to_string()),
                                    EntryKind::Output => rule.output_entries.push(String::new()),
                                }
                            }
                        }
                    }
                    "rule" => {
                        if let (Some(rule), Some(ref mut tbl)) =
                            (current_rule.take(), current_table.as_mut())
                        {
                            tbl.rules.push(rule);
                        }
                    }
                    "decisionTable" => {
                        if let (Some(tbl), Some(ref mut dec)) =
                            (current_table.take(), current_decision.as_mut())
                        {
                            dec.kind = DecisionKind::DecisionTable(tbl);
                        }
                    }
                    "decision" => {
                        if let Some(dec) = current_decision.take() {
                            drg.decisions.push(dec);
                        }
                    }
                    _ => {}
                }
            }

            _ => {}
        }

        buf.clear();
    }

    Ok(drg)
}

fn local_name_of(qualified: &[u8]) -> &str {
    let s = std::str::from_utf8(qualified).unwrap_or("");
    if let Some(pos) = s.rfind(':') {
        &s[pos + 1..]
    } else {
        s
    }
}

fn attr_value(e: &quick_xml::events::BytesStart, name: &str) -> Option<String> {
    e.attributes()
        .filter_map(|a| a.ok())
        .find(|a| local_name_of(a.key.as_ref()) == name)
        .and_then(|a| a.unescape_value().ok())
        .map(|v| v.to_string())
}

fn parse_hit_policy(s: &str) -> HitPolicy {
    match s.to_uppercase().as_str() {
        "UNIQUE" => HitPolicy::Unique,
        "FIRST" => HitPolicy::First,
        "ANY" => HitPolicy::Any,
        "COLLECT" => HitPolicy::Collect,
        "RULE ORDER" | "RULE_ORDER" => HitPolicy::RuleOrder,
        "OUTPUT ORDER" | "OUTPUT_ORDER" => HitPolicy::OutputOrder,
        _ => HitPolicy::Unique,
    }
}

// ────────────────────────────────────────────────────────────────
// Evaluator
// ────────────────────────────────────────────────────────────────

/// Evaluate a DMN decision by ID, returning a JSON value.
///
/// * For UNIQUE / FIRST: returns the first matching rule as a JSON object
///   mapping output column names to values.
/// * For COLLECT / ANY / RULE_ORDER / OUTPUT_ORDER: returns a JSON array of
///   such objects.
/// * For LiteralExpression: evaluates the expression and returns its value.
pub fn evaluate_decision(
    drg: &DmnDecisionRequirementsGraph,
    decision_id: &str,
    input: &serde_json::Value,
) -> Result<serde_json::Value, DmnError> {
    let decision = drg
        .decisions
        .iter()
        .find(|d| d.id == decision_id)
        .ok_or_else(|| DmnError::DecisionNotFound(decision_id.to_string()))?;

    match &decision.kind {
        DecisionKind::LiteralExpression(expr) => eval_literal_expression(expr, input),
        DecisionKind::DecisionTable(table) => eval_decision_table(table, input),
    }
}

fn eval_literal_expression(
    expr: &str,
    input: &serde_json::Value,
) -> Result<serde_json::Value, DmnError> {
    if expr.trim().is_empty() {
        return Ok(serde_json::Value::Null);
    }

    let ctx = reebe_feel::FeelContext::from_json(input.clone());
    let feel_expr = format!("={}", expr);
    match reebe_feel::parse_and_evaluate(&feel_expr, &ctx) {
        Ok(val) => Ok(serde_json::Value::from(val)),
        Err(e) => Err(DmnError::EvaluationError(e.to_string())),
    }
}

fn eval_decision_table(
    table: &DecisionTable,
    input: &serde_json::Value,
) -> Result<serde_json::Value, DmnError> {
    // Build a FEEL context from the input
    let ctx = reebe_feel::FeelContext::from_json(input.clone());

    // Collect matching rules
    let mut matched: Vec<serde_json::Value> = Vec::new();

    for rule in &table.rules {
        if rule_matches(rule, table, &ctx, input)? {
            let output_obj = build_output_object(rule, table)?;
            matched.push(output_obj);

            // For UNIQUE / FIRST, stop after first match
            if table.hit_policy == HitPolicy::Unique || table.hit_policy == HitPolicy::First {
                break;
            }
        }
    }

    // Zeebe (and the DMN spec): a table with a single output column yields that
    // column's value, not a one-entry context.
    if table.outputs.len() == 1 {
        let col_name = &table.outputs[0].name;
        matched = matched
            .into_iter()
            .map(|obj| obj.get(col_name).cloned().unwrap_or(serde_json::Value::Null))
            .collect();
    }

    match table.hit_policy {
        HitPolicy::Unique | HitPolicy::First => Ok(matched
            .into_iter()
            .next()
            .unwrap_or(serde_json::Value::Null)),
        HitPolicy::Collect | HitPolicy::Any | HitPolicy::RuleOrder | HitPolicy::OutputOrder => {
            Ok(serde_json::Value::Array(matched))
        }
    }
}

/// Returns true if all input entries of `rule` match the corresponding input
/// expression values from the context.
fn rule_matches(
    rule: &DecisionRule,
    table: &DecisionTable,
    ctx: &reebe_feel::FeelContext,
    input: &serde_json::Value,
) -> Result<bool, DmnError> {
    for (i, entry) in rule.input_entries.iter().enumerate() {
        let trimmed = entry.trim();

        // Empty entry or "-" matches anything
        if trimmed.is_empty() || trimmed == "-" {
            continue;
        }

        // Get the corresponding input column
        let col = table.inputs.get(i).ok_or_else(|| {
            DmnError::EvaluationError(format!(
                "Rule has more input entries than input columns (column index {})",
                i
            ))
        })?;

        // Evaluate the input expression to get the actual input value
        let input_value = evaluate_input_expr(&col.expression, ctx, input)?;

        // Check if input_value satisfies the unary test `entry`
        if !unary_test_matches(trimmed, &input_value, ctx)? {
            return Ok(false);
        }
    }

    Ok(true)
}

/// Evaluate a column input expression (e.g. "amount") against the context.
fn evaluate_input_expr(
    expr: &str,
    ctx: &reebe_feel::FeelContext,
    input: &serde_json::Value,
) -> Result<serde_json::Value, DmnError> {
    let trimmed = expr.trim();
    if trimmed.is_empty() {
        return Ok(serde_json::Value::Null);
    }

    // Try direct key lookup first (fast path for simple variable names)
    if let Some(v) = input.get(trimmed) {
        return Ok(v.clone());
    }

    // Evaluate as a FEEL expression
    let feel_expr = format!("={}", trimmed);
    match reebe_feel::parse_and_evaluate(&feel_expr, ctx) {
        Ok(val) => Ok(serde_json::Value::from(val)),
        Err(_) => Ok(serde_json::Value::Null),
    }
}

/// Test whether `input_value` satisfies the DMN unary test expression `entry`.
fn unary_test_matches(
    entry: &str,
    input_value: &serde_json::Value,
    ctx: &reebe_feel::FeelContext,
) -> Result<bool, DmnError> {
    // Range expression: [a..b] or (a..b) etc.
    if entry.starts_with('[') || entry.starts_with('(') {
        return eval_range_test(entry, input_value);
    }

    // Comparison operator: < 250, <= 250, > 250, >= 250, != 250
    if entry.starts_with('<') || entry.starts_with('>') || entry.starts_with("!=") {
        return eval_comparison_test(entry, input_value);
    }

    // Negation: not(...) — simple pass-through via FEEL
    if entry.to_lowercase().starts_with("not(") {
        return eval_feel_unary_test(entry, input_value, ctx);
    }

    // String literal: "value"
    if entry.starts_with('"') && entry.ends_with('"') {
        let expected_str = &entry[1..entry.len() - 1];
        if let Some(s) = input_value.as_str() {
            return Ok(s == expected_str);
        }
        return Ok(false);
    }

    // Comma-separated list of values: "a","b","c" or 1,2,3
    if entry.contains(',') {
        for part in entry.split(',') {
            let part = part.trim();
            if unary_test_matches(part, input_value, ctx)? {
                return Ok(true);
            }
        }
        return Ok(false);
    }

    // Boolean literal
    if entry == "true" {
        return Ok(input_value == &serde_json::Value::Bool(true));
    }
    if entry == "false" {
        return Ok(input_value == &serde_json::Value::Bool(false));
    }

    // Numeric equality
    if let Ok(n) = entry.parse::<f64>() {
        if let Some(iv) = input_value.as_f64() {
            return Ok((iv - n).abs() < f64::EPSILON);
        }
        return Ok(false);
    }

    // Fall back to FEEL evaluation: treat as equality expression
    let feel_equality = format!("={} = {}", to_feel_literal(input_value), entry);
    match reebe_feel::parse_and_evaluate(&feel_equality, ctx) {
        Ok(v) => Ok(reebe_feel::FeelValue::Bool(true) == v),
        Err(_) => Ok(false),
    }
}

/// Evaluate a range test like `[250..1000]` against `input_value`.
fn eval_range_test(entry: &str, input_value: &serde_json::Value) -> Result<bool, DmnError> {
    let start_inclusive = entry.starts_with('[');
    let end_inclusive = entry.ends_with(']');

    let inner = &entry[1..entry.len() - 1];
    let sep = inner.find("..").ok_or_else(|| {
        DmnError::EvaluationError(format!("Invalid range expression: {}", entry))
    })?;

    let start_str = inner[..sep].trim();
    let end_str = inner[sep + 2..].trim();

    let iv = input_value.as_f64().ok_or_else(|| {
        DmnError::EvaluationError(format!(
            "Cannot apply range test to non-numeric value: {:?}",
            input_value
        ))
    })?;

    let start_n = start_str.parse::<f64>().map_err(|_| {
        DmnError::EvaluationError(format!("Cannot parse range start: {}", start_str))
    })?;
    let end_n = end_str.parse::<f64>().map_err(|_| {
        DmnError::EvaluationError(format!("Cannot parse range end: {}", end_str))
    })?;

    let start_ok = if start_inclusive { iv >= start_n } else { iv > start_n };
    let end_ok = if end_inclusive { iv <= end_n } else { iv < end_n };

    Ok(start_ok && end_ok)
}

/// Evaluate a comparison unary test like `< 250`, `>= 1000`, `!= 5`.
fn eval_comparison_test(
    entry: &str,
    input_value: &serde_json::Value,
) -> Result<bool, DmnError> {
    let (op, rest) = if entry.starts_with("!=") {
        ("!=", entry[2..].trim())
    } else if entry.starts_with("<=") {
        ("<=", entry[2..].trim())
    } else if entry.starts_with(">=") {
        (">=", entry[2..].trim())
    } else if entry.starts_with('<') {
        ("<", entry[1..].trim())
    } else if entry.starts_with('>') {
        (">", entry[1..].trim())
    } else {
        return Err(DmnError::EvaluationError(format!(
            "Unknown comparison entry: {}",
            entry
        )));
    };

    let rhs = rest.parse::<f64>().map_err(|_| {
        DmnError::EvaluationError(format!("Cannot parse comparison rhs: {}", rest))
    })?;

    let lhs = input_value.as_f64().ok_or_else(|| {
        DmnError::EvaluationError(format!(
            "Cannot apply comparison to non-numeric value: {:?}",
            input_value
        ))
    })?;

    Ok(match op {
        "<" => lhs < rhs,
        "<=" => lhs <= rhs,
        ">" => lhs > rhs,
        ">=" => lhs >= rhs,
        "!=" => (lhs - rhs).abs() > f64::EPSILON,
        _ => false,
    })
}

/// Fall back to evaluating via FEEL — used for complex expressions.
fn eval_feel_unary_test(
    entry: &str,
    input_value: &serde_json::Value,
    ctx: &reebe_feel::FeelContext,
) -> Result<bool, DmnError> {
    // Build expression: `input_value in entry`
    let lhs = to_feel_literal(input_value);
    let expr = format!("={} in {}", lhs, entry);
    match reebe_feel::parse_and_evaluate(&expr, ctx) {
        Ok(v) => Ok(reebe_feel::FeelValue::Bool(true) == v),
        Err(_) => Ok(false),
    }
}

/// Convert a JSON value to a FEEL literal string for embedding in expressions.
fn to_feel_literal(v: &serde_json::Value) -> String {
    match v {
        serde_json::Value::String(s) => format!("\"{}\"", s.replace('"', "\\\"")),
        serde_json::Value::Number(n) => n.to_string(),
        serde_json::Value::Bool(b) => b.to_string(),
        serde_json::Value::Null => "null".to_string(),
        _ => "null".to_string(),
    }
}

/// Build a JSON output object for a matched rule.
fn build_output_object(
    rule: &DecisionRule,
    table: &DecisionTable,
) -> Result<serde_json::Value, DmnError> {
    let mut obj = serde_json::Map::new();

    for (i, entry) in rule.output_entries.iter().enumerate() {
        let col = table.outputs.get(i).ok_or_else(|| {
            DmnError::EvaluationError(format!(
                "Rule has more output entries than output columns (column index {})",
                i
            ))
        })?;

        let value = parse_output_entry(entry)?;
        obj.insert(col.name.clone(), value);
    }

    Ok(serde_json::Value::Object(obj))
}

/// Parse a FEEL output entry expression into a JSON value.
fn parse_output_entry(entry: &str) -> Result<serde_json::Value, DmnError> {
    let trimmed = entry.trim();

    if trimmed.is_empty() || trimmed == "null" {
        return Ok(serde_json::Value::Null);
    }

    // String literal: "value"
    if trimmed.starts_with('"') && trimmed.ends_with('"') {
        return Ok(serde_json::Value::String(
            trimmed[1..trimmed.len() - 1].to_string(),
        ));
    }

    // Boolean
    if trimmed == "true" {
        return Ok(serde_json::Value::Bool(true));
    }
    if trimmed == "false" {
        return Ok(serde_json::Value::Bool(false));
    }

    // Number
    if let Ok(i) = trimmed.parse::<i64>() {
        return Ok(serde_json::json!(i));
    }
    if let Ok(f) = trimmed.parse::<f64>() {
        return Ok(serde_json::json!(f));
    }

    // Evaluate as FEEL expression
    let feel_expr = format!("={}", trimmed);
    let ctx = reebe_feel::FeelContext::new();
    match reebe_feel::parse_and_evaluate(&feel_expr, &ctx) {
        Ok(val) => Ok(serde_json::Value::from(val)),
        Err(_) => Ok(serde_json::Value::String(trimmed.to_string())),
    }
}

// ────────────────────────────────────────────────────────────────
// Tests
// ────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const INVOICE_CLASSIFICATION_DMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             namespace="http://camunda.org/schema/1.0/dmn"
             name="DRD"
             id="invoice-classification-drg">
  <decision id="invoice-classification" name="Invoice Classification">
    <decisionTable id="decisionTable1" hitPolicy="UNIQUE">
      <input id="input1" label="Invoice Amount">
        <inputExpression id="inputExpression1" typeRef="double">
          <text>amount</text>
        </inputExpression>
      </input>
      <output id="output1" name="classification" typeRef="string"/>
      <rule id="rule1">
        <inputEntry id="inputEntry1"><text>&lt; 250</text></inputEntry>
        <outputEntry id="outputEntry1"><text>"low"</text></outputEntry>
      </rule>
      <rule id="rule2">
        <inputEntry id="inputEntry2"><text>[250..1000]</text></inputEntry>
        <outputEntry id="outputEntry2"><text>"medium"</text></outputEntry>
      </rule>
      <rule id="rule3">
        <inputEntry id="inputEntry3"><text>&gt;= 1000</text></inputEntry>
        <outputEntry id="outputEntry3"><text>"high"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>"#;

    const COLLECT_DMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             namespace="http://camunda.org/schema/1.0/dmn"
             name="DRD"
             id="multi-match-drg">
  <decision id="product-features" name="Product Features">
    <decisionTable id="dt1" hitPolicy="COLLECT">
      <input id="i1" label="Product Type">
        <inputExpression id="ie1" typeRef="string">
          <text>productType</text>
        </inputExpression>
      </input>
      <output id="o1" name="feature" typeRef="string"/>
      <rule id="r1">
        <inputEntry id="ie1r1"><text>"premium"</text></inputEntry>
        <outputEntry id="oe1r1"><text>"discount"</text></outputEntry>
      </rule>
      <rule id="r2">
        <inputEntry id="ie1r2"><text>"premium"</text></inputEntry>
        <outputEntry id="oe1r2"><text>"support"</text></outputEntry>
      </rule>
      <rule id="r3">
        <inputEntry id="ie1r3"><text>"standard"</text></inputEntry>
        <outputEntry id="oe1r3"><text>"basic"</text></outputEntry>
      </rule>
    </decisionTable>
  </decision>
</definitions>"#;

    const LITERAL_DMN: &str = r#"<?xml version="1.0" encoding="UTF-8"?>
<definitions xmlns="https://www.omg.org/spec/DMN/20191111/MODEL/"
             namespace="http://camunda.org/schema/1.0/dmn"
             name="DRD"
             id="literal-drg">
  <decision id="discount" name="Discount">
    <literalExpression>
      <text>amount * 0.1</text>
    </literalExpression>
  </decision>
</definitions>"#;

    #[test]
    fn test_parse_simple_decision_table() {
        let drg = parse_dmn(INVOICE_CLASSIFICATION_DMN).expect("should parse");
        assert_eq!(drg.id, "invoice-classification-drg");
        assert_eq!(drg.name, "DRD");
        assert_eq!(drg.decisions.len(), 1);

        let dec = &drg.decisions[0];
        assert_eq!(dec.id, "invoice-classification");

        match &dec.kind {
            DecisionKind::DecisionTable(tbl) => {
                assert_eq!(tbl.hit_policy, HitPolicy::Unique);
                assert_eq!(tbl.inputs.len(), 1);
                assert_eq!(tbl.outputs.len(), 1);
                assert_eq!(tbl.rules.len(), 3);

                assert_eq!(tbl.inputs[0].expression, "amount");
                assert_eq!(tbl.outputs[0].name, "classification");

                assert_eq!(tbl.rules[0].input_entries[0], "< 250");
                assert_eq!(tbl.rules[0].output_entries[0], "\"low\"");
                assert_eq!(tbl.rules[1].input_entries[0], "[250..1000]");
                assert_eq!(tbl.rules[2].input_entries[0], ">= 1000");
            }
            _ => panic!("expected DecisionTable"),
        }
    }

    #[test]
    fn test_evaluate_unique_hit_policy_low() {
        let drg = parse_dmn(INVOICE_CLASSIFICATION_DMN).expect("should parse");
        let result =
            evaluate_decision(&drg, "invoice-classification", &json!({"amount": 100}))
                .expect("should evaluate");
        assert_eq!(result, json!("low"));
    }

    #[test]
    fn test_evaluate_unique_hit_policy_medium() {
        let drg = parse_dmn(INVOICE_CLASSIFICATION_DMN).expect("should parse");
        let result =
            evaluate_decision(&drg, "invoice-classification", &json!({"amount": 500}))
                .expect("should evaluate");
        assert_eq!(result, json!("medium"));
    }

    #[test]
    fn test_evaluate_unique_hit_policy_high() {
        let drg = parse_dmn(INVOICE_CLASSIFICATION_DMN).expect("should parse");
        let result =
            evaluate_decision(&drg, "invoice-classification", &json!({"amount": 2000}))
                .expect("should evaluate");
        assert_eq!(result, json!("high"));
    }

    #[test]
    fn test_evaluate_collect_hit_policy() {
        let drg = parse_dmn(COLLECT_DMN).expect("should parse");
        let result =
            evaluate_decision(&drg, "product-features", &json!({"productType": "premium"}))
                .expect("should evaluate");

        let arr = result.as_array().expect("should be array");
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0], json!("discount"));
        assert_eq!(arr[1], json!("support"));
    }

    #[test]
    fn test_evaluate_collect_hit_policy_no_match() {
        let drg = parse_dmn(COLLECT_DMN).expect("should parse");
        let result = evaluate_decision(
            &drg,
            "product-features",
            &json!({"productType": "enterprise"}),
        )
        .expect("should evaluate");

        let arr = result.as_array().expect("should be array");
        assert_eq!(arr.len(), 0);
    }

    #[test]
    fn test_evaluate_literal_expression() {
        let drg = parse_dmn(LITERAL_DMN).expect("should parse");
        let result = evaluate_decision(&drg, "discount", &json!({"amount": 200}))
            .expect("should evaluate");

        // 200 * 0.1 = 20.0
        let v = result.as_f64().expect("should be number");
        assert!((v - 20.0).abs() < 0.001, "expected ~20.0, got {}", v);
    }

    #[test]
    fn test_decision_not_found() {
        let drg = parse_dmn(INVOICE_CLASSIFICATION_DMN).expect("should parse");
        let err =
            evaluate_decision(&drg, "nonexistent", &json!({})).expect_err("should fail");
        assert!(matches!(err, DmnError::DecisionNotFound(_)));
    }
}
