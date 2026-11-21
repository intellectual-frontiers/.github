script
  statements[0]: create-table ifNotExists=false temporary=false
    name: name
      parts[0]: ident name="person" quoted=false
    elements[0]: column-def
      name: ident name="id" quoted=false
      type: data-type name="INTEGER"
      constraints[0]: primary-key
    elements[1]: column-def
      name: ident name="name" quoted=false
      type: data-type name="TEXT"
    elements[2]: column-def
      name: ident name="born" quoted=false
      type: data-type name="DATE"
  statements[1]: select distinct=false groupAll=false
    items[0]: select-item
      expr: number text="1"
  statements[2]: select distinct=false groupAll=false
    items[0]: select-item
      expr: name
        parts[0]: ident name="a" quoted=false
    items[1]: select-item
      expr: name
        parts[0]: ident name="b" quoted=false
    from[0]: table
      name: name
        parts[0]: ident name="t" quoted=false
    where: binary op=">"
      left: name
        parts[0]: ident name="a" quoted=false
      right: number text="1"
  statements[3]: unparsed
error {"kind":"expected","expected":"an expression","found":"\"FROM\"","span":{"start":428,"end":432}}
