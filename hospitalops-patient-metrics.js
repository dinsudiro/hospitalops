// Revenue follows the uploaded Total Asuransi column. Missing values stay missing.
export function patientRevenue(row){
 const value=row[25];
 if(value===null||value===undefined||value==='')return null;
 const amount=Number(value);return Number.isFinite(amount)?amount:null;
}
