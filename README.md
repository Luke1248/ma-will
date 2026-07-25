This project attempts to reduce the burdens that the creation of testamentary instruments often cause marginalized populations.

This project employs Python to create a will in accordance with the Massachusetts Law Libraries' template for a single person.

## Usage

Run the helper script to inspect the fillable placeholders discovered in the Word template:

```bash
python fill_will_name.py --list-placeholders
```

Generate a JSON skeleton that includes every placeholder key. Optional clauses are pre-populated with the template text, while required fields (such as names and addresses) are blank so that you can supply the resident-specific information:

```bash
python fill_will_name.py --generate-sample values.json
```

Edit the JSON file with the Massachusetts resident's details and then produce a completed will:

```bash
python fill_will_name.py --values values.json
```

You can override the template path, the output destination, or any individual placeholder value from the command line. The positional argument remains a shortcut for `TESTATOR_NAME`:

```bash
python fill_will_name.py "Ada Lovelace" \
  --template "Will for Single Individual_ Basic (MA).docx" \
  --set CITY="Boston" --set STATE="Massachusetts"
```

Unless `--allow-missing` is provided, the script will stop if any required placeholder lacks a value, ensuring every aspect of the will that can be filled in has been addressed.
