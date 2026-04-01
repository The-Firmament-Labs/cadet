# Spec 005 — Database Inspector (SpacetimeDB Table Browser + SQL)

**Status:** Not Started
**Effort:** Medium
**Depends on:** 001 (Live Data Layer)
**Produces:** `rust/starbridge-dioxus/src/ui/views/database.rs`

---

## Context

SpacetimeDB's killer feature is that ALL subscribed table data lives in the client-side RAM cache. The database inspector is essentially free — no network calls needed for reads. This view exposes every SpacetimeDB table as a browseable data grid with live-updating row counts, sortable columns, a JSON detail panel, and an ad-hoc SQL console.

**Reference UX:** Prisma Studio (table grid with click-to-inspect) + Supabase Table Editor (SQL console below the grid).

**Data source:** All data comes from `LiveState` per-table signals (spec 001). The 33 SpacetimeDB tables are grouped into 8 categories: Core, Workflow, Messaging, Memory, Browser, Sandbox, Auth, Agent.

**Key advantage:** Because the data is already in memory, column sorting, text search within rows, and row counting are all instant (no round trips). This is a significant UX advantage over every competitor that queries a remote database.

---

## ASCII Layout

```
┌──────────────────────────────────────────────────────────────────────┐
│ app-shell                                                            │
├────────┬────────────┬────────────────────────────────────────────────┤
│sidebar │ table list │  table viewer                                  │
│        │   240px    │  fluid                                         │
│  Chat  │            │                                                │
│  Ovw   │ Core       │  ┌─ Header ──────────────────────────────────┐ │
│  Runs  │  operator  │  │ workflow_run (47 rows) | Updated: 2s ago  │ │
│  ...   │  config    │  └───────────────────────────────────────────┘ │
│  [DB]  │            │                                                │
│  ...   │ Workflow   │  ┌─ Column Filters ──────────────────────────┐ │
│        │ >run  (47) │  │ [Search all columns...] [Status: v]      │ │
│        │  step (213)│  └───────────────────────────────────────────┘ │
│        │  tool_call │  ┌─ Data Grid ───────────────────────────────┐ │
│        │            │  │ run_id   | agent | status  | goal         │ │
│        │ Messaging  │  │──────────┼───────┼─────────┼──────────────│ │
│        │  chat_msg  │  │ run_a1   │ voygr │ running │ fix auth     │ │
│        │  msg_event │  │ run_b2   │ satrn │ done    │ deploy v2    │ │
│        │  thread    │  │ run_c3   │ voygr │ blocked │ add tests    │ │
│        │            │  │ ...      │       │         │              │ │
│        │ Memory     │  └───────────────────────────────────────────┘ │
│        │  document  │                                                │
│        │  chunk     │  ┌─ Row Detail (slide-in) ───────────────────┐ │
│        │  embedding │  │ { "run_id": "run_a1",                    │ │
│        │  retrieval │  │   "agent_id": "voyager",                 │ │
│        │            │  │   "status": "running",                   │ │
│        │ Browser    │  │   "goal": "fix auth bug in...",          │ │
│        │  browser_t │  │   "created_at_micros": 1743...           │ │
│        │            │  │ }                                         │ │
│        │ ...        │  └───────────────────────────────────────────┘ │
│        │            │                                                │
│        │            │  ┌─ SQL Console ─────────────────────────────┐ │
│        │            │  │ SELECT * FROM workflow_run WHERE status   │ │
│        │            │  │ = 'running' LIMIT 10;                    │ │
│        │            │  │                            [Execute] [v]  │ │
│        │            │  └───────────────────────────────────────────┘ │
├────────┴────────────┴────────────────────────────────────────────────┤
```

---

## Requirements

### R1 — Table List with Categories and Live Row Counts
- Left panel lists all 33 SpacetimeDB tables grouped by category.
- Each table shows its name and live row count badge (from signal `.len()`).
- Row count badges update in real-time as rows are inserted/deleted.
- Categories collapsible (default: all expanded).
- Click a table to select it and show its data in the grid.

### R2 — Data Grid
- Column headers with type indicators (string, i64, bool, etc.).
- Click column header to sort ascending/descending.
- Rows rendered as a horizontally scrollable table.
- Text search input filters rows by any column value (client-side, instant).
- Cell values truncated to 60 chars with ellipsis; hover shows full value.

### R3 — Row Detail Panel
- Click a row to open a slide-in JSON detail panel on the right.
- Full JSON rendering of the row with syntax coloring.
- Copy-to-clipboard button.
- Close button or click elsewhere to dismiss.

### R4 — SQL Console
- Collapsible textarea at the bottom for ad-hoc SQL queries.
- "Execute" button runs the query via SpacetimeDB SQL reducer.
- Results displayed in a table below the console.
- Query history dropdown (last 10 queries, stored in local signal).

### R5 — Table Metadata
- Header shows: table name, row count, last update timestamp.
- Last update derived from the most recent `created_at_micros` or `updated_at_micros` in the data.

### R6 — Column Type Display
- Infer column types from the first row's values.
- Display type badges next to column headers: `str`, `i64`, `f32`, `bool`, `opt`.
- Align numeric columns right, string columns left.

---

## Files to Create / Modify

| File | Action | Purpose |
|------|--------|---------|
| `rust/starbridge-dioxus/src/ui/views/database.rs` | **Create** | Database inspector view |
| `rust/starbridge-dioxus/src/ui/views/db_types.rs` | **Create** | `TableCategory`, `TableMeta`, `ColumnDef`, grid helpers |
| `rust/starbridge-dioxus/src/ui/views/mod.rs` | **Modify** | Add `mod database; mod db_types;` |
| `rust/starbridge-dioxus/src/ui/models.rs` | **Modify** | Add `WorkspacePage::Database` variant |
| `rust/starbridge-dioxus/src/ui/styles.rs` | **Modify** | Add data grid, table list, SQL console CSS |

---

## Implementation Steps

### Step 1 — Table catalog and category types

**Commit:** `feat(database): add table catalog with categories and metadata types`

```rust
// rust/starbridge-dioxus/src/ui/views/db_types.rs

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum TableCategory {
    Core,
    Workflow,
    Messaging,
    Memory,
    Browser,
    Sandbox,
    Auth,
    Agent,
}

impl TableCategory {
    pub fn label(&self) -> &'static str {
        match self {
            TableCategory::Core => "Core",
            TableCategory::Workflow => "Workflow",
            TableCategory::Messaging => "Messaging",
            TableCategory::Memory => "Memory",
            TableCategory::Browser => "Browser",
            TableCategory::Sandbox => "Sandbox",
            TableCategory::Auth => "Auth",
            TableCategory::Agent => "Agent",
        }
    }

    pub fn all() -> Vec<TableCategory> {
        vec![
            TableCategory::Core, TableCategory::Workflow, TableCategory::Messaging,
            TableCategory::Memory, TableCategory::Browser, TableCategory::Sandbox,
            TableCategory::Auth, TableCategory::Agent,
        ]
    }
}

#[derive(Clone, Debug)]
pub struct TableMeta {
    pub name: String,
    pub category: TableCategory,
    pub row_count: usize,
}

#[derive(Clone, Debug)]
pub enum ColumnType {
    Str,
    Int,
    Float,
    Bool,
    Optional,
    Unknown,
}

impl ColumnType {
    pub fn label(&self) -> &'static str {
        match self {
            ColumnType::Str => "str",
            ColumnType::Int => "i64",
            ColumnType::Float => "f32",
            ColumnType::Bool => "bool",
            ColumnType::Optional => "opt",
            ColumnType::Unknown => "?",
        }
    }
}

#[derive(Clone, Debug)]
pub struct ColumnDef {
    pub name: String,
    pub col_type: ColumnType,
}

/// Infer column types from the first row of JSON values.
pub fn infer_columns(row: &serde_json::Value) -> Vec<ColumnDef> {
    match row.as_object() {
        Some(map) => map.iter().map(|(key, val)| {
            let col_type = match val {
                serde_json::Value::String(_) => ColumnType::Str,
                serde_json::Value::Number(n) => {
                    if n.is_f64() { ColumnType::Float } else { ColumnType::Int }
                }
                serde_json::Value::Bool(_) => ColumnType::Bool,
                serde_json::Value::Null => ColumnType::Optional,
                _ => ColumnType::Unknown,
            };
            ColumnDef { name: key.clone(), col_type }
        }).collect(),
        None => vec![],
    }
}

/// Build the full table catalog with row counts from LiveState.
/// Each table maps to a signal; this function reads .len() from each.
pub fn build_catalog(counts: &[(String, TableCategory, usize)]) -> Vec<TableMeta> {
    counts.iter().map(|(name, cat, count)| TableMeta {
        name: name.clone(),
        category: cat.clone(),
        row_count: *count,
    }).collect()
}

/// Sort rows by a column key, ascending or descending.
pub fn sort_rows(
    rows: &mut Vec<serde_json::Value>,
    column: &str,
    ascending: bool,
) {
    rows.sort_by(|a, b| {
        let va = a.get(column).map(|v| v.to_string()).unwrap_or_default();
        let vb = b.get(column).map(|v| v.to_string()).unwrap_or_default();
        if ascending { va.cmp(&vb) } else { vb.cmp(&va) }
    });
}

/// Filter rows where any column value contains the query string.
pub fn filter_rows<'a>(
    rows: &'a [serde_json::Value],
    query: &str,
) -> Vec<&'a serde_json::Value> {
    if query.is_empty() { return rows.iter().collect(); }
    let q = query.to_lowercase();
    rows.iter().filter(|row| {
        if let Some(obj) = row.as_object() {
            obj.values().any(|v| v.to_string().to_lowercase().contains(&q))
        } else {
            false
        }
    }).collect()
}
```

**Test:** `test_infer_columns` with a sample JSON object. `test_sort_rows` ascending and descending. `test_filter_rows` with matching and non-matching queries.

---

### Step 2 — Database view component with table list

**Commit:** `feat(database): add DatabaseView with table list sidebar and data grid`

```rust
// rust/starbridge-dioxus/src/ui/views/database.rs

use dioxus::prelude::*;
use super::db_types::*;

#[component]
pub fn DatabaseView() -> Element {
    let mut selected_table = use_signal(|| None::<String>);
    let mut search_query = use_signal(String::new);
    let mut sort_column = use_signal(|| None::<String>);
    let mut sort_asc = use_signal(|| true);
    let mut selected_row = use_signal(|| None::<serde_json::Value>);
    let mut collapsed_categories = use_signal(Vec::<TableCategory>::new);

    // In real implementation, read from LiveState signals
    // For now, placeholder catalog
    let catalog: Vec<TableMeta> = vec![]; // populated from LiveState

    rsx! {
        div { class: "page-grid page-grid-database",
            // Table list sidebar
            section { class: "db-table-list",
                div { class: "panel-head",
                    p { class: "section-eyebrow", "SPACETIMEDB" }
                    h3 { class: "card-title", "Tables" }
                }
                div { class: "db-category-list",
                    for category in TableCategory::all() {
                        div { class: "db-category",
                            div {
                                class: "db-category-header",
                                onclick: {
                                    let cat = category.clone();
                                    move |_| {
                                        let mut collapsed = collapsed_categories.write();
                                        if collapsed.contains(&cat) {
                                            collapsed.retain(|c| c != &cat);
                                        } else {
                                            collapsed.push(cat.clone());
                                        }
                                    }
                                },
                                span { "{category.label()}" }
                            }
                            if !collapsed_categories().contains(&category) {
                                for table in catalog.iter().filter(|t| t.category == category) {
                                    div {
                                        class: if selected_table() == Some(table.name.clone()) {
                                            "db-table-item db-table-item-active"
                                        } else {
                                            "db-table-item"
                                        },
                                        onclick: {
                                            let name = table.name.clone();
                                            move |_| selected_table.set(Some(name.clone()))
                                        },
                                        span { "{table.name}" }
                                        span { class: "db-row-count", "{table.row_count}" }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Data grid area
            section { class: "db-grid-area",
                // Search bar
                div { class: "db-search-bar",
                    input {
                        class: "search-input",
                        placeholder: "Search all columns...",
                        value: search_query(),
                        oninput: move |e| search_query.set(e.value()),
                    }
                }

                // Grid placeholder
                div { class: "db-data-grid",
                    // Column headers with sort + type badges
                    // Rows rendered from filtered/sorted data
                    // Click row to set selected_row
                }

                // Row detail slide-in
                if let Some(row) = selected_row() {
                    div { class: "db-row-detail",
                        div { class: "db-row-detail-header",
                            h4 { "Row Detail" }
                            button {
                                class: "secondary-button",
                                onclick: move |_| selected_row.set(None),
                                "Close"
                            }
                        }
                        pre { class: "db-json",
                            "{serde_json::to_string_pretty(&row).unwrap_or_default()}"
                        }
                    }
                }
            }
        }
    }
}
```

**Test:** Build the app, navigate to Database view, verify table list renders with categories and the data grid area is present.

---

### Step 3 — SQL console component

**Commit:** `feat(database): add SQL console with execute button and query history`

```rust
#[component]
fn SqlConsole(
    on_execute: EventHandler<String>,
) -> Element {
    let mut query = use_signal(String::new);
    let mut history = use_signal(Vec::<String>::new);
    let mut show_history = use_signal(|| false);

    rsx! {
        div { class: "sql-console",
            div { class: "sql-console-header",
                span { class: "section-eyebrow", "SQL CONSOLE" }
                button {
                    class: "secondary-button",
                    onclick: move |_| show_history.set(!show_history()),
                    "History ({history().len()})"
                }
            }
            if show_history() {
                div { class: "sql-history",
                    for (i, q) in history().iter().enumerate().rev().take(10) {
                        div {
                            class: "sql-history-item",
                            onclick: {
                                let q = q.clone();
                                move |_| {
                                    query.set(q.clone());
                                    show_history.set(false);
                                }
                            },
                            "{q}"
                        }
                    }
                }
            }
            textarea {
                class: "sql-input",
                placeholder: "SELECT * FROM workflow_run WHERE status = 'running' LIMIT 10;",
                value: query(),
                oninput: move |e| query.set(e.value()),
            }
            div { class: "sql-actions",
                button {
                    class: "primary-button",
                    disabled: query().trim().is_empty(),
                    onclick: move |_| {
                        let q = query();
                        if !q.trim().is_empty() {
                            history.write().push(q.clone());
                            on_execute.call(q);
                        }
                    },
                    "Execute"
                }
            }
        }
    }
}
```

**Test:** Type a SQL query, click Execute, verify `on_execute` called. Click History, verify previous queries listed.

---

### Step 4 — Database CSS and navigation integration

**Commit:** `style(database): add data grid, table list, SQL console styles`

```css
.page-grid-database {
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 0;
}
.db-table-list {
    background: var(--surface-container-low);
    border-right: 1px solid var(--outline-variant);
    overflow-y: auto;
}
.db-category-header {
    padding: 6px 12px;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--on-surface-variant);
    cursor: pointer;
    font-weight: 600;
}
.db-table-item {
    display: flex;
    justify-content: space-between;
    padding: 5px 12px 5px 20px;
    font-size: 12px;
    cursor: pointer;
    font-family: var(--mono);
}
.db-table-item:hover { background: var(--surface-container); }
.db-table-item-active { background: var(--primary); color: var(--on-primary); }
.db-row-count {
    font-size: 10px;
    background: var(--secondary-container);
    padding: 1px 6px;
    min-width: 24px;
    text-align: center;
}

.db-grid-area {
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.db-search-bar {
    padding: 8px 12px;
    border-bottom: 1px solid var(--outline-variant);
}
.db-data-grid {
    flex: 1;
    overflow: auto;
}
.db-data-grid table {
    width: 100%;
    border-collapse: collapse;
    font-family: var(--mono);
    font-size: 11px;
}
.db-data-grid th {
    position: sticky;
    top: 0;
    background: var(--surface-container);
    padding: 6px 10px;
    text-align: left;
    cursor: pointer;
    white-space: nowrap;
    border-bottom: 1px solid var(--outline-variant);
    font-weight: 600;
}
.db-data-grid th:hover { background: var(--surface-container-high); }
.db-data-grid td {
    padding: 4px 10px;
    border-bottom: 1px solid rgba(224, 191, 184, 0.1);
    max-width: 200px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.db-data-grid tr:hover { background: var(--surface-container-low); }
.db-type-badge {
    font-size: 9px;
    color: var(--secondary);
    margin-left: 4px;
}

.db-row-detail {
    border-left: 1px solid var(--outline-variant);
    padding: 12px;
    max-width: 400px;
    overflow-y: auto;
    background: var(--surface-container-lowest);
}
.db-json {
    font-family: var(--mono);
    font-size: 11px;
    white-space: pre-wrap;
    word-break: break-all;
}

.sql-console {
    border-top: 1px solid var(--outline-variant);
    padding: 8px 12px;
    background: var(--surface-container-low);
}
.sql-input {
    width: 100%;
    min-height: 60px;
    font-family: var(--mono);
    font-size: 11px;
    background: #1a1a1f;
    color: #e8e6e3;
    border: 1px solid var(--outline-variant);
    padding: 8px;
    resize: vertical;
}
.sql-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
.sql-history {
    max-height: 120px;
    overflow-y: auto;
    margin-bottom: 6px;
}
.sql-history-item {
    padding: 3px 8px;
    font-family: var(--mono);
    font-size: 10px;
    cursor: pointer;
    color: var(--on-surface-variant);
}
.sql-history-item:hover { background: var(--surface-container); }
```

**Test:** Navigate to Database view, verify table list has category headers, data grid has sticky headers, SQL console has dark-themed textarea.

---

## Regression Tests

| # | Test | Validates |
|---|------|-----------|
| 1 | `test_infer_columns_string_int_bool` | JSON `{"a":"x","b":1,"c":true}` infers `Str, Int, Bool` |
| 2 | `test_infer_columns_empty` | Empty JSON object returns empty vec |
| 3 | `test_sort_rows_ascending` | Sorting by "name" ascending produces A-Z order |
| 4 | `test_sort_rows_descending` | Sorting by "name" descending produces Z-A order |
| 5 | `test_filter_rows_match` | Filtering "running" matches rows with that status |
| 6 | `test_filter_rows_no_match` | Filtering "zzz" returns empty vec |
| 7 | `test_filter_rows_empty_query` | Empty query returns all rows |
| 8 | `test_build_catalog` | 5 table entries produce 5 `TableMeta` with correct categories |
| 9 | `test_table_category_all` | `TableCategory::all()` returns 8 categories |
| 10 | `cargo build --features desktop-ui` | Full app compiles with database view |

---

## Definition of Done

- [ ] Table list sidebar shows all 33 tables grouped by 8 categories
- [ ] Row count badges update in real-time as SpacetimeDB data changes
- [ ] Click a table to display its data in the grid
- [ ] Column headers show type badges (str, i64, f32, bool)
- [ ] Click column header to sort ascending/descending
- [ ] Search input filters rows across all columns (instant, client-side)
- [ ] Click a row to open JSON detail slide-in panel
- [ ] Copy-to-clipboard button in detail panel works
- [ ] SQL console textarea accepts queries
- [ ] Execute button runs query and displays results
- [ ] Query history stores last 10 queries
- [ ] All 10 regression tests pass
- [ ] `cargo build --features desktop-ui` succeeds

---

## PR Template

```markdown
## Summary
- Added SpacetimeDB table browser with live row counts from client-side cache
- Built data grid with column sorting, type badges, and full-text search
- Implemented JSON row detail slide-in panel with copy button
- Added SQL console with execute, results display, and query history

## Test plan
- [ ] Navigate to Database view, verify all 33 tables listed
- [ ] Click `workflow_run` table, verify grid shows rows
- [ ] Click "status" column header, verify sort toggles
- [ ] Type "running" in search, verify rows filter
- [ ] Click a row, verify JSON detail panel slides in
- [ ] Type SQL query, click Execute, verify results
- [ ] Run `cargo test` — all 10 tests pass
- [ ] Run `cargo build --features desktop-ui` — builds clean
```
