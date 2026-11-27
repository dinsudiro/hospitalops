// Choose one revenue value per visit. Zero is present, never a reason to fall back.
const empty=value=>value===null||value===undefined||typeof value==='string'&&value.trim()==='';
export function patientRevenueDetail(row){
 const insurancePresent=!empty(row[25]),value=insurancePresent?row[25]:row[12];
 if(empty(value))return {amount:null,source:null};
 const amount=Number(value);return Number.isFinite(amount)?{amount,source:insurancePresent?'Total Asuransi':'Total Billing'}:{amount:null,source:null};
}
export function patientRevenue(row){return patientRevenueDetail(row).amount;}
export function patientRevenueSource(row){return patientRevenueDetail(row).source;}
