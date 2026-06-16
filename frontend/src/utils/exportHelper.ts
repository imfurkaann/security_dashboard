import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import dayjs from './dayjsConfig';

export interface ExportGroup<T> {
    dayKey: string;
    dayLabel: string;
    records: T[];
}

export interface ExportConfig<T> {
    exportGroups: ExportGroup<T>[];
    headerRow: string[];
    columnWidths: number[];
    mapRecordToRow: (record: T) => any[];
    sheetName: string;
    filePrefix: string;
    zipNamePrefix: string;
}

export const exportRecordsToExcelAndZip = async <T>({
    exportGroups,
    headerRow,
    columnWidths,
    mapRecordToRow,
    sheetName,
    filePrefix,
    zipNamePrefix
}: ExportConfig<T>): Promise<void> => {
    const dayFiles: Array<{ fileName: string; data: ArrayBuffer }> = [];

    for (const dayGroup of exportGroups) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(sheetName);

        worksheet.columns = columnWidths.map(width => ({ width }));

        const header = worksheet.addRow(headerRow);
        header.height = 24;
        header.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1D4ED8' }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
                right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
            };
        });

        dayGroup.records.forEach((record) => {
            const row = worksheet.addRow(mapRecordToRow(record));
            row.eachCell((cell) => {
                cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
                    right: { style: 'thin', color: { argb: 'FFE5E7EB' } }
                };
            });
        });

        const formattedDayForFileName = dayjs(dayGroup.dayKey).format('DD-MM-YYYY');
        const fileName = `${filePrefix}${formattedDayForFileName}.xlsx`;
        const workbookBuffer = await workbook.xlsx.writeBuffer();
        dayFiles.push({ fileName, data: workbookBuffer as ArrayBuffer });
    }

    const triggerDownload = (blob: Blob, fileName: string) => {
        return new Promise<void>((resolve) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
            link.style.display = 'none';
            document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
                resolve();
            }, 500);
        });
    };

    if (dayFiles.length === 1) {
        const [singleFile] = dayFiles;
        const blob = new Blob([singleFile.data], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        await triggerDownload(blob, singleFile.fileName);
        return;
    }

    const zip = new JSZip();
    dayFiles.forEach((file) => {
        zip.file(file.fileName, file.data);
    });

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const timestamp = dayjs().format('DD-MM-YYYY_HH-mm');
    await triggerDownload(zipBlob, `${zipNamePrefix}_Toplu_${timestamp}.zip`);
};
