import { describe, expect, it } from "vitest";
import { sanitizeContext, fenceContext, sanitizeUrl, sanitizeHtml, sanitizeToolResult } from "../sanitize";

describe("sanitizeContext", () => {
  it("passes through normal text unchanged", () => {
    expect(sanitizeContext("Hello world")).toBe("Hello world");
  });

  it("strips control characters but keeps newlines and tabs", () => {
    expect(sanitizeContext("hello\x00world")).toBe("helloworld");
    expect(sanitizeContext("hello\nworld")).toBe("hello\nworld");
    expect(sanitizeContext("hello\tworld")).toBe("hello\tworld");
  });

  it("strips zero-width characters", () => {
    expect(sanitizeContext("hello\u200Bworld")).toBe("helloworld");
    expect(sanitizeContext("test\uFEFFvalue")).toBe("testvalue");
    expect(sanitizeContext("a\u200Cb\u200Dc")).toBe("abc");
  });

  it("truncates content beyond maxLength", () => {
    const long = "a".repeat(10000);
    const result = sanitizeContext(long, 100);
    expect(result).toContain("[TRUNCATED]");
    expect(result.length).toBeLessThanOrEqual(115);
  });

  it("handles empty string", () => {
    expect(sanitizeContext("")).toBe("");
  });

  it("preserves legitimate technical content", () => {
    const code = "function handleSubmit() { return new Promise() }";
    expect(sanitizeContext(code)).toBe(code);
  });

  it("preserves markdown formatting", () => {
    const md = "## Header\n- Item 1\n- Item 2\n```js\nconsole.log('hi')\n```";
    expect(sanitizeContext(md)).toBe(md);
  });
});

describe("fenceContext", () => {
  it("wraps content in context tags with label", () => {
    const result = fenceContext("memory", "some content");
    expect(result).toContain('<context source="memory">');
    expect(result).toContain("some content");
    expect(result).toContain("</context>");
  });

  it("includes 'reference data only' instruction", () => {
    const result = fenceContext("ref", "content");
    expect(result).toContain("reference data only");
  });

  it("escapes HTML in the label attribute", () => {
    const result = fenceContext('test<script>"alert', "content");
    expect(result).toContain("&lt;script&gt;&quot;alert");
  });
});

describe("sanitizeUrl", () => {
  it("allows valid https URLs", () => {
    expect(sanitizeUrl("https://example.com/page")).toBe("https://example.com/page");
  });

  it("allows valid http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("blocks javascript: protocol", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("blocks file: protocol", () => {
    expect(sanitizeUrl("file:///etc/passwd")).toBeNull();
  });

  it("blocks localhost", () => {
    expect(sanitizeUrl("http://localhost:3000")).toBeNull();
    expect(sanitizeUrl("http://127.0.0.1:8080")).toBeNull();
  });

  it("blocks private network ranges", () => {
    expect(sanitizeUrl("http://10.0.0.1")).toBeNull();
    expect(sanitizeUrl("http://172.16.0.1")).toBeNull();
    expect(sanitizeUrl("http://192.168.1.1")).toBeNull();
  });

  it("blocks cloud metadata endpoints", () => {
    expect(sanitizeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(sanitizeUrl("http://metadata.google.internal")).toBeNull();
  });

  it("blocks decimal IP notation for localhost", () => {
    expect(sanitizeUrl("http://2130706433")).toBeNull(); // 127.0.0.1
  });

  it("blocks hex IP notation for localhost", () => {
    expect(sanitizeUrl("http://0x7f000001")).toBeNull(); // 127.0.0.1
  });

  it("blocks decimal IP for metadata endpoint", () => {
    expect(sanitizeUrl("http://2852039166")).toBeNull(); // 169.254.169.254
  });

  it("blocks IPv4-mapped IPv6", () => {
    expect(sanitizeUrl("http://[::ffff:127.0.0.1]")).toBeNull();
    expect(sanitizeUrl("http://[::ffff:169.254.169.254]")).toBeNull();
    expect(sanitizeUrl("http://[::ffff:10.0.0.1]")).toBeNull();
  });

  it("blocks IPv6 loopback variants", () => {
    expect(sanitizeUrl("http://[::1]")).toBeNull();
    expect(sanitizeUrl("http://[0000::1]")).toBeNull();
  });

  it("blocks .local and .internal domains", () => {
    expect(sanitizeUrl("http://myservice.local")).toBeNull();
    expect(sanitizeUrl("http://db.internal")).toBeNull();
  });

  it("allows legitimate public IPs", () => {
    expect(sanitizeUrl("http://8.8.8.8")).not.toBeNull();
    expect(sanitizeUrl("https://1.1.1.1")).not.toBeNull();
  });

  it("does NOT block public 172.x addresses outside private range", () => {
    // 172.32+ is public
    expect(sanitizeUrl("http://172.32.0.1")).not.toBeNull();
    expect(sanitizeUrl("http://172.64.0.1")).not.toBeNull();
  });

  it("returns null for invalid URLs", () => {
    expect(sanitizeUrl("not a url")).toBeNull();
    expect(sanitizeUrl("")).toBeNull();
  });
});

describe("sanitizeHtml", () => {
  it("strips HTML tags", () => {
    expect(sanitizeHtml("<p>Hello</p>")).toBe("Hello");
  });

  it("strips script blocks entirely", () => {
    const result = sanitizeHtml("<p>Safe</p><script>alert('xss')</script><p>Also safe</p>");
    expect(result).not.toContain("alert");
    expect(result).toContain("Safe");
  });

  it("strips style blocks entirely", () => {
    const result = sanitizeHtml("<style>.evil{}</style><p>Content</p>");
    expect(result).not.toContain(".evil");
  });

  it("decodes HTML entities", () => {
    expect(sanitizeHtml("&amp; &lt; &gt; &quot; &#39;")).toBe('& < > " \'');
  });

  it("truncates to maxLength", () => {
    const long = "<p>" + "a".repeat(5000) + "</p>";
    const result = sanitizeHtml(long, 100);
    expect(result.length).toBeLessThanOrEqual(115);
  });
});

describe("sanitizeToolResult", () => {
  it("strips invisible chars from string results", () => {
    expect(sanitizeToolResult("hello\x00world")).toBe("helloworld");
  });

  it("strips invisible chars from object string values", () => {
    const result = sanitizeToolResult({ message: "hello\u200Bworld", count: 5 }) as Record<string, unknown>;
    expect(result.message).toBe("helloworld");
    expect(result.count).toBe(5);
  });

  it("passes through non-string/non-object values", () => {
    expect(sanitizeToolResult(42)).toBe(42);
    expect(sanitizeToolResult(null)).toBeNull();
    expect(sanitizeToolResult(true)).toBe(true);
  });

  it("passes through clean strings unchanged", () => {
    expect(sanitizeToolResult("normal result")).toBe("normal result");
  });
});
