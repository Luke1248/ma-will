This project attempts to reduce the burdens that the creation of testamentary instruments often cause marginalized populations.

This project employs Python to create a will in accordance with the Massachusetts Law Libraries' template for a single person.

## Usage

Run the helper script to insert the testator's name into the provided Word template:

```bash
python fill_will_name.py "Ada Lovelace"
```

By default, the script uses the included template and writes a new file alongside it (for example, `Will_for_Ada-Lovelace.docx`).  You can override the paths if desired:

```bash
python fill_will_name.py "Ada Lovelace" --template path/to/template.docx --output ada_will.docx
```
