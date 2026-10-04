"""A command's form, from its typed arguments (0041-command-line FR-013, FR-026; 0042-agora FR-024).

Fields, their choices and what is required all come from the command's declaration and the types it names; the server
validates what comes back with the same types (cli.values_from_raw), so the form and the terminal cannot disagree.
"""
from __future__ import annotations

import html
from typing import Any

from agora.core.registry import WRITES, Command

MAX_SELECT = 80  # a type with more choices than this is a text field with suggestions
MAX_SUGGEST = 300


def h(v: Any) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def _choices(reg: Any, ctx: Any, type_name: str | None) -> list[str]:
    t = reg.types.get(type_name or "")
    if t is None:
        return []
    try:
        return list(t.choices(ctx))
    except Exception:
        return []


def _examples(reg: Any, ctx: Any, type_name: str | None) -> str:
    t = reg.types.get(type_name or "")
    try:
        return ", ".join(t.examples(ctx)[:2]) if t else ""
    except Exception:
        return ""


def _field(reg: Any, ctx: Any, cid: str, name: str, label: str, type_name: str | None, help_: str, required: bool,
           multiple: bool, defaults: dict[str, Any]) -> str:
    fid = f"f-{cid}-{name}".replace(" ", "-").replace("_", "-")
    t = reg.types.get(type_name or "")
    doc = f"{type_name}: {t.doc}" if t else (type_name or "")
    hint = " ".join(x for x in (help_, doc if t else "", "One per line." if multiple and not _choices(reg, ctx, type_name) else "") if x)
    req = " required" if required else ""
    got = defaults.get(name)
    got_list = [str(x) for x in got] if isinstance(got, (list, tuple)) else ([str(got)] if got not in (None, "") else [])
    choices = _choices(reg, ctx, type_name)
    if type_name is None:  # a flag
        control = f'<label class="fc-check"><input type="checkbox" name="{h(name)}" value="true"{" checked" if got else ""}> {h(label)}</label>'
        return f'<div class="fc-field">{control}<p class="fc-hint">{h(help_)}</p></div>'
    if choices and len(choices) <= MAX_SELECT:
        opts = "".join(f'<option value="{h(c)}"{" selected" if c in got_list else ""}>{h(c)}</option>' for c in choices)
        if multiple:
            control = f'<select class="fc-select" id="{fid}" name="{h(name)}" multiple size="{min(8, len(choices))}" aria-describedby="{fid}-hint">{opts}</select>'
        else:
            blank = "" if required else '<option value="">(none)</option>'
            control = f'<select class="fc-select" id="{fid}" name="{h(name)}"{req} aria-describedby="{fid}-hint">{blank}{opts}</select>'
    elif multiple:
        control = (f'<textarea class="fc-textarea" id="{fid}" name="{h(name)}" rows="3"{req} aria-describedby="{fid}-hint" '
                   f'placeholder="{h(_examples(reg, ctx, type_name))}">{h(chr(10).join(got_list))}</textarea>')
    else:
        listing = ""
        attr = ""
        if choices:
            listing = f'<datalist id="{fid}-list">' + "".join(f'<option value="{h(c)}"></option>' for c in choices[:MAX_SUGGEST]) + "</datalist>"
            attr = f' list="{fid}-list"'
        control = (f'<input class="fc-input" id="{fid}" name="{h(name)}" type="text" autocomplete="off" spellcheck="false"{req}{attr} '
                   f'value="{h(got_list[0] if got_list else "")}" placeholder="{h(_examples(reg, ctx, type_name))}" '
                   f'aria-describedby="{fid}-hint">{listing}')
    star = " (required)" if required else ""
    return (f'<div class="fc-field"><label class="fc-label" for="{fid}">{h(label)}{star}</label>{control}'
            f'<p class="fc-hint" id="{fid}-hint">{h(hint)}</p></div>')


def command_form(reg: Any, ctx: Any, cmd: Command, defaults: dict[str, Any] | None = None, autorun: bool = False) -> str:
    """The form that runs a command: one field for each argument and option, and a button that says what it will do."""
    defaults = defaults or {}
    cid = cmd.id.replace(" ", "-")
    fields = [f'<input type="hidden" name="cmd" value="{h(cmd.id)}">']
    for a in cmd.args:
        fields.append(_field(reg, ctx, cid, a.name, a.name.replace("_", " "), a.type, a.help, a.required, a.many, defaults))
    for o in cmd.options:
        fields.append(_field(reg, ctx, cid, o.dest, o.flag, o.type, o.help, o.required, o.multiple, defaults))
    if cmd.category in WRITES:
        label, tone, note = "Preview the change (--dry-run)", "primary", "Nothing is written until you have seen the preview and run it."
    else:
        label, tone, note = "Run", "primary", ""
    if cmd.category == "decision":
        note = "A decision: it changes what only a person decides. You see the preview, then confirm."
    init = " data-init=\"@post('/act/start', {contentType: 'form'})\"" if autorun else ""  # a read command that is run as the page opens
    return (f'<form class="fc-form" id="form-{h(cid)}"{init} data-on:submit__prevent="@post(\'/act/start\', {{contentType: \'form\'}})">'
            + "".join(fields) + (f'<p class="fc-hint">{h(note)}</p>' if note else "")
            + f'<div class="fc-form__actions"><button class="fc-btn" data-variant="{tone}" type="submit">{h(label)}</button></div></form>')


def hidden_fields(raw: dict[str, Any]) -> str:
    """A call's fields as hidden inputs, repeated for a list, so a button can post the same call."""
    out = []
    for k, v in raw.items():
        if v is None or v is False or v == []:
            continue
        for x in (v if isinstance(v, (list, tuple)) else [v]):
            out.append(f'<input type="hidden" name="{h(k)}" value="{h("true" if x is True else x)}">')
    return "".join(out)


def post_form(action: str, inner: str, extra_class: str = "fc-inline") -> str:
    return (f'<form class="{extra_class}" data-on:submit__prevent="@post(\'{action}\', {{contentType: \'form\'}})">{inner}</form>')
