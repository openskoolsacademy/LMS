import * as XLSX from 'xlsx';

/**
 * Exports data to an Excel file (.xlsx)
 * @param {Array} data - The array of objects to export
 * @param {string} fileName - The name of the file
 */
export const exportToExcel = (data, fileName = 'Revenue_Report') => {
  if (!data || data.length === 0) {
    console.error('No data to export');
    return;
  }

  // Create a worksheet
  const worksheet = XLSX.utils.json_to_sheet(data);

  // Create a workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

  // Export to file using a robust manual approach to ensure the filename is set correctly
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
  
  const finalFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
  
  // Create download link
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', finalFileName);
  document.body.appendChild(link);
  link.click();
  
  // Cleanup
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};
