# Player Import Template Design

> Goal: Make bulk player registration easier by letting admins download a ready-made spreadsheet template before upload.

## Recommendation

Add a `양식 다운로드` button to the existing bulk import panel and generate the template on the client with `xlsx`.
Use the same header names that the import parser already expects: `group`, `region`, `affiliation`, `name`, `hand`.

## UX Flow

- Admin clicks `양식 다운로드`
- Browser downloads an `.xlsx` file
- Admin fills the rows under the provided header and sample rows
- Admin uploads the file through the existing picker

## Data Rules

- Keep the current import schema unchanged
- Include at least two sample rows
- Show short instructions in the panel so the user understands the sequence

## Validation

- Add a small script test for the workbook builder
- Run the script first to confirm failure before implementation
- Run the script again after implementation
- Run `npm run build`
