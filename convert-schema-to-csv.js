const fs = require('fs');
const path = require('path');

const sqlFilePath = path.join(__dirname, 'unanecessary', 'database-schema.sql');
const csvFilePath = path.join(__dirname, 'unanecessary', 'vynix_db_rows.csv');

function parseSqlLine(line) {
    const cleanLine = line.replace(/,$/, '').trim();
    const parts = cleanLine.split(/\s+/);
    if (parts.length < 2) {
        return [null, null, null];
    }
    const columnName = parts[0];
    const restOfLine = parts.slice(1).join(' ');

    const typeRegex = /^[a-zA-Z_]+(?:\([^)]+\))?/;
    const typeMatch = restOfLine.match(typeRegex);
    
    let dataType = '';
    let constraints = '';

    if (typeMatch) {
        dataType = typeMatch[0];
        constraints = restOfLine.substring(dataType.length).trim();
    } else {
        dataType = parts[1] || '';
        constraints = parts.slice(2).join(' ');
    }
    
    return [columnName, dataType, constraints];
}

try {
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    const tableRegex = /CREATE TABLE\s+([\w`"]+)\s+\(([\s\S]*?)\);/g;
    let match;
    const csvRows = [['TableName', 'ColumnName', 'DataType', 'Constraints']];

    while ((match = tableRegex.exec(sqlContent)) !== null) {
        const tableName = match[1].replace(/[`"]/g, '');
        const columnsBlock = match[2];
        const columnLines = columnsBlock.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('--'));

        for (const line of columnLines) {
            if (line.startsWith('PRIMARY KEY') || line.startsWith('UNIQUE') || line.startsWith('FOREIGN KEY') || line.startsWith('CONSTRAINT')) {
                continue;
            }
            const [columnName, dataType, constraints] = parseSqlLine(line);
            if (columnName && dataType) {
                csvRows.push([`"${tableName}"`, `"${columnName}"`, `"${dataType}"`, `"${constraints}"`]);
            }
        }
    }

    const csvContent = csvRows.map(row => row.join(',')).join('\n');
    fs.writeFileSync(csvFilePath, csvContent);

    console.log(`Successfully fixed and regenerated CSV at: ${csvFilePath}`);

} catch (error) {
    console.error('Failed to convert schema to CSV:', error);
} 