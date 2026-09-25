//! Who may talk to the AI server — the same rules as `@bpmnkit/proxy`
//! (`apps/proxy/src/access.ts`).
//!
//! `/chat` starts an AI CLI on this machine, so a web page or a machine on the
//! network must not be able to reach it:
//!
//! - it listens on loopback unless `BPMNKIT_PROXY_HOST` says otherwise;
//! - the `Host` header must be a loopback name or one listed in
//!   `BPMNKIT_PROXY_ALLOWED_HOSTS`, which stops DNS rebinding;
//! - a browser `Origin` must be first-party, loopback, or listed in
//!   `BPMNKIT_PROXY_ALLOWED_ORIGINS`; anything else gets 403, and a cross-site
//!   request without an `Origin` is refused by its `Sec-Fetch-Site`.

use axum::extract::Request;
use axum::http::{header, HeaderMap, StatusCode};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};

/// bpmnkit.com, hosted Studio, and the desktop app's webview.
pub const FIRST_PARTY_ORIGINS: &[&str] = &[
    "https://bpmnkit.com",
    "https://studio.bpmnkit.com",
    "https://bpmnkit-studio.pages.dev",
    "tauri://localhost",
    "http://tauri.localhost",
    "https://tauri.localhost",
];

const LOOPBACK_HOSTNAMES: &[&str] = &["localhost", "127.0.0.1", "[::1]"];

#[derive(Clone, Debug, Default)]
pub struct AccessPolicy {
    pub origins: Vec<String>,
    pub hosts: Vec<String>,
}

fn list(value: Option<String>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn normalise_origin(origin: &str) -> String {
    origin.trim().trim_end_matches('/').to_ascii_lowercase()
}

/// The host name of a `Host` header value, without port or trailing dot.
fn hostname(host: &str) -> String {
    let host = host.trim().to_ascii_lowercase();
    let name = if host.starts_with('[') {
        match host.find(']') {
            Some(end) => host[..=end].to_string(),
            None => host,
        }
    } else {
        host.split(':').next().unwrap_or("").to_string()
    };
    name.trim_end_matches('.').to_string()
}

/// True for `localhost`, `127.0.0.1` and `::1` in any spelling.
pub fn is_loopback_host(host: &str) -> bool {
    let bracketed = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host.to_string()
    };
    LOOPBACK_HOSTNAMES.contains(&hostname(&bracketed).as_str())
}

impl AccessPolicy {
    pub fn from_env() -> Self {
        Self::new(
            list(std::env::var("BPMNKIT_PROXY_ALLOWED_ORIGINS").ok()),
            list(std::env::var("BPMNKIT_PROXY_ALLOWED_HOSTS").ok()),
        )
    }

    pub fn new(extra_origins: Vec<String>, extra_hosts: Vec<String>) -> Self {
        let mut origins: Vec<String> = FIRST_PARTY_ORIGINS.iter().map(|o| o.to_string()).collect();
        for o in extra_origins {
            let o = normalise_origin(&o);
            // A wildcard would undo the check; refuse it rather than honour it.
            if !o.is_empty() && o != "*" && o != "null" {
                origins.push(o);
            }
        }
        let mut hosts: Vec<String> = LOOPBACK_HOSTNAMES.iter().map(|h| h.to_string()).collect();
        hosts.extend(extra_hosts.iter().map(|h| hostname(h)));
        Self { origins, hosts }
    }

    pub fn origin_allowed(&self, origin: &str) -> bool {
        let origin = normalise_origin(origin);
        if self.origins.contains(&origin) {
            return true;
        }
        for scheme in ["http://", "https://"] {
            if let Some(rest) = origin.strip_prefix(scheme) {
                if !rest.contains('/') && LOOPBACK_HOSTNAMES.contains(&hostname(rest).as_str()) {
                    return true;
                }
            }
        }
        false
    }

    /// `Err(reason)` when the request must be refused.
    pub fn check(&self, headers: &HeaderMap) -> Result<(), String> {
        let host = headers
            .get(header::HOST)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");
        if host.is_empty() || !self.hosts.contains(&hostname(host)) {
            return Err(format!(
                "The server only answers requests addressed to localhost, not \"{host}\". Allow another with BPMNKIT_PROXY_ALLOWED_HOSTS."
            ));
        }
        if let Some(origin) = headers.get(header::ORIGIN) {
            let origin = origin.to_str().unwrap_or("null");
            if self.origin_allowed(origin) {
                return Ok(());
            }
            return Err(format!(
                "Origin \"{origin}\" may not use the server. Allow it with BPMNKIT_PROXY_ALLOWED_ORIGINS."
            ));
        }
        match headers.get("sec-fetch-site").and_then(|v| v.to_str().ok()) {
            None | Some("same-origin") | Some("none") => Ok(()),
            Some(_) => Err("Cross-site browser requests without an Origin are refused.".into()),
        }
    }
}

/// Middleware: refuse with 403 before any route — or the CORS layer — runs.
pub async fn guard(policy: AccessPolicy, req: Request, next: Next) -> Response {
    match policy.check(req.headers()) {
        Ok(()) => next.run(req).await,
        Err(reason) => {
            eprintln!("[access] refused {} {} — {reason}", req.method(), req.uri());
            (StatusCode::FORBIDDEN, reason).into_response()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::HeaderValue;

    fn headers(pairs: &[(&'static str, &str)]) -> HeaderMap {
        let mut h = HeaderMap::new();
        for (k, v) in pairs {
            h.insert(*k, HeaderValue::from_str(v).unwrap());
        }
        h
    }

    #[test]
    fn allows_first_party_loopback_and_programs() {
        let p = AccessPolicy::new(vec![], vec![]);
        assert!(p.check(&headers(&[("host", "localhost:3033")])).is_ok());
        for o in FIRST_PARTY_ORIGINS {
            assert!(p
                .check(&headers(&[("host", "127.0.0.1:3033"), ("origin", o)]))
                .is_ok());
        }
        assert!(p
            .check(&headers(&[
                ("host", "[::1]:3033"),
                ("origin", "http://localhost:1420")
            ]))
            .is_ok());
    }

    #[test]
    fn refuses_foreign_origins_rebinding_and_cross_site() {
        let p = AccessPolicy::new(vec!["*".into()], vec![]);
        for o in [
            "https://evil.example",
            "null",
            "https://bpmnkit.com.evil.example",
            "http://localhost.evil.example",
        ] {
            assert!(
                p.check(&headers(&[("host", "localhost:3033"), ("origin", o)]))
                    .is_err(),
                "{o}"
            );
        }
        assert!(p.check(&headers(&[("host", "evil.example:3033")])).is_err());
        assert!(p.check(&HeaderMap::new()).is_err());
        assert!(p
            .check(&headers(&[
                ("host", "localhost:3033"),
                ("sec-fetch-site", "cross-site")
            ]))
            .is_err());
    }

    #[test]
    fn honours_configured_origins_and_hosts() {
        let p = AccessPolicy::new(
            vec!["https://Intranet.example/".into()],
            vec!["devbox.lan".into()],
        );
        assert!(p
            .check(&headers(&[
                ("host", "devbox.lan:3033"),
                ("origin", "https://intranet.example")
            ]))
            .is_ok());
    }

    #[test]
    fn loopback_hosts() {
        assert!(is_loopback_host("127.0.0.1"));
        assert!(is_loopback_host("::1"));
        assert!(is_loopback_host("localhost"));
        assert!(!is_loopback_host("0.0.0.0"));
    }
}
