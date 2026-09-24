use crate::ast::Expr;
use crate::lexer::Token;
use crate::types::FeelError;

/// Recursive descent parser for FEEL expressions.
pub struct Parser {
    tokens: Vec<Token>,
    pos: usize,
}

impl Parser {
    pub fn new(tokens: Vec<Token>) -> Self {
        Self { tokens, pos: 0 }
    }

    fn peek(&self) -> &Token {
        self.tokens.get(self.pos).unwrap_or(&Token::Eof)
    }

    fn advance(&mut self) -> &Token {
        let tok = &self.tokens[self.pos];
        self.pos += 1;
        tok
    }

    fn expect(&mut self, expected: &Token) -> Result<(), FeelError> {
        let tok = self.advance().clone();
        if std::mem::discriminant(&tok) == std::mem::discriminant(expected) {
            Ok(())
        } else {
            Err(FeelError::ParseError(format!(
                "Expected {:?}, got {:?}",
                expected, tok
            )))
        }
    }

    fn at_eof(&self) -> bool {
        matches!(self.peek(), Token::Eof)
    }

    /// Parse a full expression
    pub fn parse_expr(&mut self) -> Result<Expr, FeelError> {
        // Check for for/some/every/if at top level
        match self.peek().clone() {
            Token::For => return self.parse_for(),
            Token::Some => return self.parse_some(),
            Token::Every => return self.parse_every(),
            Token::If => return self.parse_if(),
            _ => {}
        }
        self.parse_or()
    }

    fn parse_for(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume 'for'
        let var = match self.advance().clone() {
            Token::Ident(name) => name,
            tok => return Err(FeelError::ParseError(format!("Expected variable name after 'for', got {:?}", tok))),
        };
        self.expect(&Token::In)?;
        let list = self.parse_or()?;
        self.expect(&Token::Return)?;
        let body = self.parse_or()?;
        Ok(Expr::For(var, Box::new(list), Box::new(body)))
    }

    fn parse_some(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume 'some'
        let var = match self.advance().clone() {
            Token::Ident(name) => name,
            tok => return Err(FeelError::ParseError(format!("Expected variable name after 'some', got {:?}", tok))),
        };
        self.expect(&Token::In)?;
        let list = self.parse_or()?;
        self.expect(&Token::Satisfies)?;
        let cond = self.parse_or()?;
        Ok(Expr::Some(var, Box::new(list), Box::new(cond)))
    }

    fn parse_every(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume 'every'
        let var = match self.advance().clone() {
            Token::Ident(name) => name,
            tok => return Err(FeelError::ParseError(format!("Expected variable name after 'every', got {:?}", tok))),
        };
        self.expect(&Token::In)?;
        let list = self.parse_or()?;
        self.expect(&Token::Satisfies)?;
        let cond = self.parse_or()?;
        Ok(Expr::Every(var, Box::new(list), Box::new(cond)))
    }

    fn parse_if(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume 'if'
        let cond = self.parse_or()?;
        self.expect(&Token::Then)?;
        let then = self.parse_or()?;
        self.expect(&Token::Else)?;
        let els = self.parse_or()?;
        Ok(Expr::If(Box::new(cond), Box::new(then), Box::new(els)))
    }

    fn parse_or(&mut self) -> Result<Expr, FeelError> {
        let mut left = self.parse_and()?;
        while matches!(self.peek(), Token::Or) {
            self.advance();
            let right = self.parse_and()?;
            left = Expr::Or(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_and(&mut self) -> Result<Expr, FeelError> {
        let mut left = self.parse_in()?;
        while matches!(self.peek(), Token::And) {
            self.advance();
            let right = self.parse_in()?;
            left = Expr::And(Box::new(left), Box::new(right));
        }
        Ok(left)
    }

    fn parse_in(&mut self) -> Result<Expr, FeelError> {
        let left = self.parse_comparison()?;
        if matches!(self.peek(), Token::In) {
            self.advance();
            let right = self.parse_range_or_list()?;
            return Ok(Expr::In(Box::new(left), Box::new(right)));
        }
        if matches!(self.peek(), Token::InstanceOf) {
            self.advance();
            let type_name = match self.advance().clone() {
                Token::Ident(name) => name,
                tok => return Err(FeelError::ParseError(format!("Expected type name after 'instance of', got {:?}", tok))),
            };
            return Ok(Expr::InstanceOf(Box::new(left), type_name));
        }
        Ok(left)
    }

    fn parse_range_or_list(&mut self) -> Result<Expr, FeelError> {
        // If starts with '[' or '(' followed by expression '..' expression ']'/')'
        // This can be a range or a list.
        // We delegate to parse_range_or_primary which handles the ambiguity.
        match self.peek().clone() {
            Token::LBracket => {
                // Could be a range [a..b] or list [a, b, c]
                self.parse_bracket_range_or_list()
            }
            Token::LParen => {
                // Could be a range (a..b)
                self.parse_paren_range()
            }
            _ => self.parse_primary(),
        }
    }

    fn parse_bracket_range_or_list(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume '['
        if matches!(self.peek(), Token::RBracket) {
            self.advance();
            return Ok(Expr::List(vec![]));
        }
        let first = self.parse_or()?;
        if matches!(self.peek(), Token::DoubleDot) {
            // Range [start..end]
            self.advance(); // consume '..'
            let end = self.parse_or()?;
            let end_inclusive = match self.advance().clone() {
                Token::RBracket => true,
                Token::RParen => false,
                tok => return Err(FeelError::ParseError(format!("Expected ']' or ')' to close range, got {:?}", tok))),
            };
            return Ok(Expr::Range {
                start: Box::new(first),
                end: Box::new(end),
                start_inclusive: true,
                end_inclusive,
            });
        }
        // It's a list
        let mut items = vec![first];
        while matches!(self.peek(), Token::Comma) {
            self.advance();
            if matches!(self.peek(), Token::RBracket) {
                break;
            }
            items.push(self.parse_or()?);
        }
        self.expect(&Token::RBracket)?;
        Ok(Expr::List(items))
    }

    fn parse_paren_range(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume '('
        let start = self.parse_or()?;
        self.expect(&Token::DoubleDot)?;
        let end = self.parse_or()?;
        let end_inclusive = match self.advance().clone() {
            Token::RParen => false,
            Token::RBracket => true,
            tok => return Err(FeelError::ParseError(format!("Expected ')' or ']' to close range, got {:?}", tok))),
        };
        Ok(Expr::Range {
            start: Box::new(start),
            end: Box::new(end),
            start_inclusive: false,
            end_inclusive,
        })
    }

    fn parse_comparison(&mut self) -> Result<Expr, FeelError> {
        let left = self.parse_additive()?;
        match self.peek().clone() {
            Token::Eq => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Eq(Box::new(left), Box::new(right)))
            }
            Token::Ne => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Ne(Box::new(left), Box::new(right)))
            }
            Token::Lt => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Lt(Box::new(left), Box::new(right)))
            }
            Token::Le => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Le(Box::new(left), Box::new(right)))
            }
            Token::Gt => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Gt(Box::new(left), Box::new(right)))
            }
            Token::Ge => {
                self.advance();
                let right = self.parse_additive()?;
                Ok(Expr::Ge(Box::new(left), Box::new(right)))
            }
            _ => Ok(left),
        }
    }

    fn parse_additive(&mut self) -> Result<Expr, FeelError> {
        let mut left = self.parse_multiplicative()?;
        loop {
            match self.peek().clone() {
                Token::Plus => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expr::Add(Box::new(left), Box::new(right));
                }
                Token::Minus => {
                    self.advance();
                    let right = self.parse_multiplicative()?;
                    left = Expr::Sub(Box::new(left), Box::new(right));
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_multiplicative(&mut self) -> Result<Expr, FeelError> {
        let mut left = self.parse_unary()?;
        loop {
            match self.peek().clone() {
                Token::Star => {
                    self.advance();
                    let right = self.parse_unary()?;
                    left = Expr::Mul(Box::new(left), Box::new(right));
                }
                Token::Slash => {
                    self.advance();
                    let right = self.parse_unary()?;
                    left = Expr::Div(Box::new(left), Box::new(right));
                }
                _ => break,
            }
        }
        Ok(left)
    }

    fn parse_unary(&mut self) -> Result<Expr, FeelError> {
        match self.peek().clone() {
            Token::Not => {
                self.advance();
                let expr = self.parse_postfix()?;
                Ok(Expr::Not(Box::new(expr)))
            }
            Token::Minus => {
                self.advance();
                let expr = self.parse_postfix()?;
                Ok(Expr::Neg(Box::new(expr)))
            }
            _ => self.parse_postfix(),
        }
    }

    fn parse_postfix(&mut self) -> Result<Expr, FeelError> {
        let mut expr = self.parse_primary()?;
        loop {
            match self.peek().clone() {
                Token::Dot => {
                    self.advance();
                    match self.advance().clone() {
                        Token::Ident(name) => {
                            expr = Expr::Path(Box::new(expr), name);
                        }
                        tok => return Err(FeelError::ParseError(format!("Expected field name after '.', got {:?}", tok))),
                    }
                }
                Token::LBracket => {
                    self.advance();
                    let filter = self.parse_or()?;
                    self.expect(&Token::RBracket)?;
                    expr = Expr::Filter(Box::new(expr), Box::new(filter));
                }
                _ => break,
            }
        }
        Ok(expr)
    }

    fn parse_primary(&mut self) -> Result<Expr, FeelError> {
        match self.peek().clone() {
            Token::Null => {
                self.advance();
                Ok(Expr::Null)
            }
            Token::True => {
                self.advance();
                Ok(Expr::Bool(true))
            }
            Token::False => {
                self.advance();
                Ok(Expr::Bool(false))
            }
            Token::Integer(n) => {
                let n = n;
                self.advance();
                Ok(Expr::Integer(n))
            }
            Token::Float(f) => {
                let f = f;
                self.advance();
                Ok(Expr::Float(f))
            }
            Token::StringLit(s) => {
                let s = s.clone();
                self.advance();
                Ok(Expr::Str(s))
            }
            Token::LParen => {
                self.advance();
                let expr = self.parse_expr()?;
                self.expect(&Token::RParen)?;
                Ok(expr)
            }
            Token::LBracket => {
                self.parse_bracket_range_or_list()
            }
            Token::LBrace => {
                self.parse_context_literal()
            }
            Token::If => self.parse_if(),
            Token::For => self.parse_for(),
            Token::Some => self.parse_some(),
            Token::Every => self.parse_every(),
            Token::Not => {
                self.advance();
                // 'not' can also be a function call: not(expr)
                if matches!(self.peek(), Token::LParen) {
                    self.advance();
                    let inner = self.parse_expr()?;
                    self.expect(&Token::RParen)?;
                    Ok(Expr::Not(Box::new(inner)))
                } else {
                    let inner = self.parse_primary()?;
                    Ok(Expr::Not(Box::new(inner)))
                }
            }
            Token::Ident(name) => {
                let name = name.clone();
                self.advance();
                // Check if it's a function call
                if matches!(self.peek(), Token::LParen) {
                    self.advance(); // consume '('
                    if matches!(self.peek(), Token::Ident(_))
                        && matches!(self.tokens.get(self.pos + 1), Some(Token::Colon))
                    {
                        return self.parse_named_args(name);
                    }
                    let mut args = Vec::new();
                    if !matches!(self.peek(), Token::RParen) {
                        args.push(self.parse_expr()?);
                        while matches!(self.peek(), Token::Comma) {
                            self.advance();
                            if matches!(self.peek(), Token::RParen) {
                                break;
                            }
                            args.push(self.parse_expr()?);
                        }
                    }
                    self.expect(&Token::RParen)?;
                    Ok(Expr::FunctionCall(name, args))
                } else {
                    Ok(Expr::Name(name))
                }
            }
            tok => Err(FeelError::ParseError(format!("Unexpected token: {:?}", tok))),
        }
    }

    /// The named arguments of a call, `name(a: expr, b: expr)`; `(` is consumed.
    fn parse_named_args(&mut self, name: String) -> Result<Expr, FeelError> {
        let mut args = Vec::new();
        while !matches!(self.peek(), Token::RParen | Token::Eof) {
            let arg = match self.advance().clone() {
                Token::Ident(arg) => arg,
                tok => return Err(FeelError::ParseError(format!("Expected a parameter name, got {:?}", tok))),
            };
            self.expect(&Token::Colon)?;
            args.push((arg, self.parse_expr()?));
            if matches!(self.peek(), Token::Comma) {
                self.advance();
            }
        }
        self.expect(&Token::RParen)?;
        Ok(Expr::NamedFunctionCall(name, args))
    }

    fn parse_context_literal(&mut self) -> Result<Expr, FeelError> {
        self.advance(); // consume '{'
        let mut pairs = Vec::new();
        while !matches!(self.peek(), Token::RBrace | Token::Eof) {
            let key = match self.advance().clone() {
                Token::Ident(name) => name,
                Token::StringLit(s) => s,
                tok => return Err(FeelError::ParseError(format!("Expected context key, got {:?}", tok))),
            };
            self.expect(&Token::Colon)?;
            let val = self.parse_or()?;
            pairs.push((key, val));
            if matches!(self.peek(), Token::Comma) {
                self.advance();
            }
        }
        self.expect(&Token::RBrace)?;
        Ok(Expr::Context(pairs))
    }
}

pub fn parse(tokens: Vec<Token>) -> Result<Expr, FeelError> {
    let mut parser = Parser::new(tokens);
    let expr = parser.parse_expr()?;
    if !parser.at_eof() {
        return Err(FeelError::ParseError(format!(
            "Unexpected tokens after expression: {:?}",
            parser.peek()
        )));
    }
    Ok(expr)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::lexer::tokenize;

    fn parse_str(s: &str) -> Expr {
        let tokens = tokenize(s).unwrap();
        parse(tokens).unwrap()
    }

    #[test]
    fn test_parse_integer() {
        assert_eq!(parse_str("42"), Expr::Integer(42));
    }

    #[test]
    fn test_parse_addition() {
        assert_eq!(
            parse_str("1 + 2"),
            Expr::Add(Box::new(Expr::Integer(1)), Box::new(Expr::Integer(2)))
        );
    }

    #[test]
    fn test_parse_comparison() {
        assert_eq!(
            parse_str("x > 5"),
            Expr::Gt(Box::new(Expr::Name("x".to_string())), Box::new(Expr::Integer(5)))
        );
    }

    #[test]
    fn test_parse_if() {
        let expr = parse_str("if x then 1 else 2");
        assert!(matches!(expr, Expr::If(_, _, _)));
    }

    #[test]
    fn test_parse_function_call() {
        let expr = parse_str(r#"contains("hello world", "world")"#);
        assert!(matches!(expr, Expr::FunctionCall(_, _)));
    }

    #[test]
    fn test_parse_range() {
        let expr = parse_str("[1..10]");
        assert!(matches!(expr, Expr::Range { start_inclusive: true, end_inclusive: true, .. }));
    }

    #[test]
    fn test_parse_list() {
        let expr = parse_str("[1, 2, 3]");
        assert!(matches!(expr, Expr::List(_)));
    }

    #[test]
    fn test_parse_context() {
        let expr = parse_str("{x: 1, y: 2}");
        assert!(matches!(expr, Expr::Context(_)));
    }
}
