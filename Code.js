// Default backend URL if no URL is provided
var defaultBackendUrl = 'https://4a87-182-71-246-66.ngrok-free.app/generate-seed';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Custom Tools')
    .addItem('Show Seed Generator', 'showSeedGeneratorSidebar')
    .addItem('Show Update Seed', 'showUpdateSeedSidebar')
    .addToUi();
}

function showSeedGeneratorSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('Sidebar')
    .setTitle('Seed Generator')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showUpdateSeedSidebar() {
  var html = HtmlService.createHtmlOutputFromFile('UpdateSidebar')
    .setTitle('Update Seed')
    .setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function extractDataAndSend(salesNotes, backendUrl) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = {
      "Section 1": extractSection(sheet, 2, 9, ['A', 'B']),
      "Section 2": extractSection(sheet, 11, 16, ['A', 'B']),
      "Section 3": extractSection(sheet, 18, 23, ['A', 'B', 'C']),
      "Section 4": extractSection(sheet, 25, 31, ['A', 'B', 'C']),
      "Section 5": extractSection(sheet, 33, 47, ['A', 'B', 'C']),
      "Section 6": extractSection(sheet, 49, 53, ['A', 'B', 'C', 'D', 'E', 'F', 'G']),
      "Section 7": extractSection(sheet, 55, 70, ['A', 'B', 'C'])
    };

    var payload = {
      "sales_document": data,
      "sales_notes": salesNotes
    };

    var jsonData = JSON.stringify(payload, null, 2);

    var apiUrl = backendUrl || defaultBackendUrl;

    var response = UrlFetchApp.fetch(apiUrl, {
      method: 'post',
      contentType: 'application/json',
      payload: jsonData
    });

    var responseData = JSON.parse(response.getContentText());
    var seed = responseData;

    var seedString = JSON.stringify(seed, null, 2);

    return {
      "seed": seedString
    };
  } catch (error) {
    Logger.log('Error: %s', error.toString());
    throw new Error('Failed to process data. Check the logs for details.');
  }
}

function extractSection(sheet, startRow, endRow, columns) {
  var sectionData = [];
  
  var headingRange = sheet.getRange(startRow, 1, 1, sheet.getLastColumn());
  var heading = headingRange.getValues()[0].join(' ').trim();
  
  for (var i = startRow; i <= endRow; i++) {
    var rowData = {};
    columns.forEach(function(column) {
      rowData[column] = sheet.getRange(column + i).getValue();
    });
    sectionData.push(rowData);
  }
  
  return {
    "heading": heading,
    "rows": sectionData
  };
}

function updateSeed(seedData) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    if (!sheet) {
      Logger.log('Failed to get active sheet.');
      throw new Error('No active sheet found.');
    }

    var data = JSON.parse(seedData);
    var formattedData = [];
    
    // Iterate through JSON data and flatten it into a 2D array
    for (var section in data) {
      // Add section heading with empty cells to match the number of columns
      formattedData.push([section, '', '']); 

      var sectionData = data[section];
      for (var item in sectionData) {
        var rowData = sectionData[item];

        // If rowData is an object, iterate through its keys and values
        if (typeof rowData === 'object' && rowData !== null) {
          for (var key in rowData) {
            var value = rowData[key];
            formattedData.push([item, key, value]); // Push item, key, and value in separate columns
          }
        } else {
          // If rowData is a primitive value, just add it as a single row
          formattedData.push([item, rowData, '']); // Add an extra empty cell to match 3 columns
        }
      }
    }
    
    Logger.log('Formatted Data: %s', JSON.stringify(formattedData, null, 2));

    // Determine the maximum number of columns required for the data
    var maxColumns = Math.max(...formattedData.map(row => row.length));

    // Ensure every row has the same number of columns by padding shorter rows
    formattedData = formattedData.map(row => {
      while (row.length < maxColumns) {
        row.push(''); // Add empty values to match the column count
      }
      return row;
    });

    // Find an empty block with the correct number of rows and columns
    var range = findEmptyBlock(sheet, formattedData.length, maxColumns);
    Logger.log('Range: %s', JSON.stringify(range));

    if (range) {
      var targetRange = sheet.getRange(range.row, range.col, formattedData.length, maxColumns);
      targetRange.setValues(formattedData);
      return {
        "seed": seedData,
        "row": range.row
      };
    } else {
      throw new Error('No empty block found in the sheet.');
    }
  } catch (error) {
    Logger.log('Error: %s', error.toString());
    throw new Error('Failed to update seed. Check the logs for details.');
  }
}





function findEmptyBlock(sheet, numRows, numCols) {
  if (!sheet) {
    Logger.log('Sheet is undefined or null');
    throw new Error('Sheet is undefined. Ensure the sheet is correctly initialized.');
  }

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  
  // Extend the range to check for empty space
  var maxRows = lastRow + numRows;
  var maxCols = lastCol + numCols;

  // Adjusting maxRows and maxCols to not exceed sheet limits
  maxRows = Math.min(maxRows, sheet.getMaxRows());
  maxCols = Math.min(maxCols, sheet.getMaxColumns());

  // Iterate through the rows and columns to find an empty block
  for (var row = 1; row <= maxRows - numRows + 1; row++) {
    for (var col = 1; col <= maxCols - numCols + 1; col++) {
      var range = sheet.getRange(row, col, numRows, numCols);
      var values = range.getValues();
      var empty = true;

      // Check if all cells in the block are empty
      for (var r = 0; r < numRows; r++) {
        for (var c = 0; c < numCols; c++) {
          if (values[r][c] !== "") {
            empty = false;
            break;
          }
        }
        if (!empty) break;
      }

      if (empty) {
        return { row: row, col: col };
      }
    }
  }

  // Return null if no empty block is found
  return null;
}

