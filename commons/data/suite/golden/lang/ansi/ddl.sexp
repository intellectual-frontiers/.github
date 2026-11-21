script
  statements[0]: create-table ifNotExists=true
    name: name
      parts[0]: ident name="s" quoted=false
      parts[1]: ident name="person" quoted=false
    elements[0]: column-def
      name: ident name="id" quoted=false
      type: data-type name="INTEGER"
      constraints[0]: primary-key
    elements[1]: column-def
      name: ident name="name" quoted=false
      type: data-type name="VARCHAR"
        args[0]: number text="100"
      constraints[0]: not-null
      constraints[1]: default
        expr: string value="x" prefix=""
    elements[2]: column-def
      name: ident name="email" quoted=false
      type: data-type name="TEXT"
      constraints[0]: unique
      constraints[1]: check
        expr: like op="LIKE" negated=false
          arg: name
            parts[0]: ident name="email" quoted=false
          pattern: string value="%@%" prefix=""
    elements[3]: column-def
      name: ident name="born" quoted=false
      type: data-type name="DATE"
      constraints[0]: foreign-key
        reference: reference onDelete="cascade" onUpdate="no-action"
          table: name
            parts[0]: ident name="s" quoted=false
            parts[1]: ident name="country" quoted=false
          columns[0]: ident name="code" quoted=false
    elements[4]: column-def
      name: ident name="seen" quoted=false
      type: data-type name="TIMESTAMP WITH TIME ZONE"
    elements[5]: column-def
      name: ident name="score" quoted=false
      type: data-type name="DECIMAL"
        args[0]: number text="5"
        args[1]: number text="2"
      constraints[0]: check
        name: ident name="score_ok" quoted=false
        expr: binary op=">="
          left: name
            parts[0]: ident name="score" quoted=false
          right: number text="0"
    elements[6]: primary-key
      name: ident name="person_pk" quoted=false
      columns[0]: ident name="id" quoted=false
    elements[7]: unique
      columns[0]: ident name="email" quoted=false
      columns[1]: ident name="name" quoted=false
    elements[8]: foreign-key
      columns[0]: ident name="born" quoted=false
      reference: reference onDelete="set-null"
        table: name
          parts[0]: ident name="country" quoted=false
        columns[0]: ident name="code" quoted=false
    elements[9]: check
      expr: binary op=">"
        left: name
          parts[0]: ident name="id" quoted=false
        right: number text="0"
  statements[1]: create-index unique=true ifNotExists=true
    name: name
      parts[0]: ident name="person_name" quoted=false
    table: name
      parts[0]: ident name="person" quoted=false
    items[0]: order-item direction="desc"
      expr: name
        parts[0]: ident name="name" quoted=false
    items[1]: order-item
      expr: call distinct=false
        name: name
          parts[0]: ident name="lower" quoted=false
        args[0]: name
          parts[0]: ident name="email" quoted=false
    where: is test="null" negated=true
      arg: name
        parts[0]: ident name="name" quoted=false
  statements[2]: create-index unique=false ifNotExists=false
    table: name
      parts[0]: ident name="t" quoted=false
    items[0]: order-item
      expr: name
        parts[0]: ident name="a" quoted=false
  statements[3]: create-view orReplace=true
    name: name
      parts[0]: ident name="v" quoted=false
    columns[0]: ident name="a" quoted=false
    columns[1]: ident name="b" quoted=false
    query: select distinct=false
      items[0]: select-item
        expr: number text="1"
      items[1]: select-item
        expr: number text="2"
  statements[4]: create-view orReplace=false
    name: name
      parts[0]: ident name="w" quoted=false
    query: with recursive=false
      ctes[0]: cte
        name: ident name="c" quoted=false
        query: select distinct=false
          items[0]: select-item
            expr: number text="1"
      body: select distinct=false
        items[0]: select-item
          expr: star
        from[0]: table
          name: name
            parts[0]: ident name="c" quoted=false
  statements[5]: alter-table ifExists=false
    table: name
      parts[0]: ident name="t" quoted=false
    actions[0]: add-column ifNotExists=true
      column: column-def
        name: ident name="c" quoted=false
        type: data-type name="INTEGER"
        constraints[0]: not-null
    actions[1]: drop-column ifExists=false
      name: ident name="d" quoted=false
    actions[2]: drop-constraint ifExists=true
      name: ident name="k" quoted=false
    actions[3]: add-constraint
      constraint: unique
        name: ident name="u" quoted=false
        columns[0]: ident name="c" quoted=false
    actions[4]: rename-column
      from: ident name="a" quoted=false
      to: ident name="b" quoted=false
  statements[6]: alter-table ifExists=true
    table: name
      parts[0]: ident name="t" quoted=false
    actions[0]: rename-table
      to: ident name="u" quoted=false
  statements[7]: drop object="table" ifExists=true behavior="cascade"
    names[0]: name
      parts[0]: ident name="a" quoted=false
    names[1]: name
      parts[0]: ident name="s" quoted=false
      parts[1]: ident name="b" quoted=false
  statements[8]: drop object="view" ifExists=false
    names[0]: name
      parts[0]: ident name="v" quoted=false
  statements[9]: drop object="index" ifExists=false behavior="restrict"
    names[0]: name
      parts[0]: ident name="i" quoted=false
