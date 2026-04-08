import { useState, useMemo, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const SERVICES = ["Phone","Soft Phone","Text","Dialer","Speech Analytics"];
const SVC_COLOR = {"Phone":"#60a5fa","Soft Phone":"#a78bfa","Text":"#34d399","Dialer":"#fb923c","Speech Analytics":"#e879f9"};
const SVC_MRR   = {"Phone":35,"Soft Phone":25,"Text":15,"Dialer":50,"Speech Analytics":75};

const STAGES_CA  = ["CRM Entry","Order Confirmed","Welcome Sent","Handed to PM"];
const STAGES_PM  = ["Plan","Kickoff Scheduled","Kickoff Complete","Port Ordered","Install & Port Date Set","Training Complete","Activation Ready","Client Activated","Handed to Support"];
const STAGES_INS = ["Survey Scheduled","Survey Complete","Survey Approved","Install Scheduled","Installing","Install Complete"];
const STAGES_ACC = ["Scope Review","Equipment Invoiced","Payment Confirmed","Install Invoiced","Closed"];
const ALL_STAGES = [...STAGES_CA,...STAGES_PM,...STAGES_INS,...STAGES_ACC];

const BOTTLENECK = {"CRM Entry":2,"Order Confirmed":1,"Welcome Sent":3,"Handed to PM":1,"Plan":3,"Kickoff Scheduled":5,"Kickoff Complete":2,"Port Ordered":5,"Install & Port Date Set":3,"Training Complete":3,"Activation Ready":2,"Client Activated":2,"Survey Scheduled":5,"Survey Complete":2,"Survey Approved":2,"Install Scheduled":7,"Installing":3,"Scope Review":2,"Equipment Invoiced":3,"Payment Confirmed":7,"Install Invoiced":7};
const SC = {"CRM Entry":"#818cf8","Order Confirmed":"#60a5fa","Welcome Sent":"#a78bfa","Handed to PM":"#34d399","Plan":"#38bdf8","Kickoff Scheduled":"#fb923c","Kickoff Complete":"#fbbf24","Port Ordered":"#e879f9","Install & Port Date Set":"#60a5fa","Training Complete":"#34d399","Activation Ready":"#4ade80","Client Activated":"#4ade80","Handed to Support":"#2dd4bf","Survey Scheduled":"#fb923c","Survey Complete":"#fbbf24","Survey Approved":"#4ade80","Install Scheduled":"#38bdf8","Installing":"#f87171","Install Complete":"#4ade80","Scope Review":"#818cf8","Equipment Invoiced":"#fb923c","Payment Confirmed":"#4ade80","Install Invoiced":"#fbbf24","Closed":"#2dd4bf"};
const NEXT_STAGE = {"CRM Entry":"Order Confirmed","Order Confirmed":"Welcome Sent","Welcome Sent":"Handed to PM","Plan":"Kickoff Scheduled","Kickoff Scheduled":"Kickoff Complete","Kickoff Complete":"Port Ordered","Port Ordered":"Install & Port Date Set","Install & Port Date Set":"Training Complete","Training Complete":"Activation Ready","Activation Ready":"Client Activated","Client Activated":"Handed to Support","Survey Scheduled":"Survey Complete","Survey Complete":"Survey Approved","Survey Approved":"Install Scheduled","Install Scheduled":"Installing","Installing":"Install Complete","Scope Review":"Equipment Invoiced","Equipment Invoiced":"Payment Confirmed","Payment Confirmed":"Install Invoiced","Install Invoiced":"Closed"};

const STAFF_ROLES = ["Contract Admin","Project Manager","Installer","Accounting","Sales"];
const ROLE_COLOR  = {"Contract Admin":"#e879f9","Project Manager":"#38bdf8","Installer":"#fb923c","Accounting":"#4ade80","Sales":"#fbbf24"};
const ROLE_ICON   = {"Contract Admin":"📝","Project Manager":"📊","Installer":"🔧","Accounting":"💰","Sales":"💼"};

const NAV_TABS = ["Today","Overview","Customers","Projects","Sales","Contract Admin","Project Manager","Installer","Inventory","Accounting","Tasks","Staff","Search"];
const todayStr = new Date().toISOString().slice(0,10);
const today = new Date(todayStr);

// ── Helpers ───────────────────────────────────────────────────────────────────
const f$ = v => "$"+Number(v||0).toLocaleString();
const daysSince = d => d ? Math.floor((today-new Date(d))/86400000) : 0;
const daysUntil = d => d ? Math.floor((new Date(d)-today)/86400000) : 999;
const stageProgress = s => { const i=ALL_STAGES.indexOf(s); return i<0?0:Math.round((i/(ALL_STAGES.length-1))*100); };
const calcMRR = (svcs,lines) => svcs.reduce((a,sv)=>a+(SVC_MRR[sv]||0),0)*(lines||1);

function calcRisk(p) {
  let score=0,flags=[];
  const age=p.stageEnteredDate?daysSince(p.stageEnteredDate):0;
  const lim=BOTTLENECK[p.stage]||5;
  if(age/lim>=1){score+=Math.min(30,Math.round((age/lim)*20));flags.push("aging");}
  if(p.riskBlocked){score+=25;flags.push("blocked");}
  const unpaidDays=p.billing?.equipPaymentDate?0:p.billing?.equipInvoiceDate?daysSince(p.billing.equipInvoiceDate):0;
  if(unpaidDays>7){score+=20;flags.push("unpaid");}
  if(Object.values(p.inventory||{}).some(v=>v.required>0&&v.reserved<v.required)){score+=15;flags.push("inv_short");}
  const idays=p.installDate?daysUntil(p.installDate):999;
  if(idays<=7&&!Object.values(p.inventory||{}).some(v=>v.staged>0)&&Object.values(p.inventory||{}).some(v=>v.required>0)){score+=10;flags.push("ship_risk");}
  return{score:Math.min(100,score),flags};
}
const riskColor = s => s>=50?"#f87171":s>=25?"#fbbf24":"#4ade80";
const calcMargin = p => { const t=(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0);const cost=p.billing?.totalCost;if(cost&&cost>0&&t>0){const gm=Math.round(((t-cost)/t)*100);return{total:t,gm,label:gm+"%"};}return{total:t,gm:t>0?40:0,label:t>0?"40% (est.)":"—"}; };

// ── Gate Logic ────────────────────────────────────────────────────────────────
function getGates(p) {
  const g=[],s=p.stage;
  if(s==="CRM Entry"){g.push({l:"Company, contact, phone, rep filled",met:!!(p.company&&p.contact&&p.phone&&p.rep)});g.push({l:"1+ service selected",met:(p.services||[]).length>0});g.push({l:"Zoho Deal ID set",met:!!p.zohoDealId});g.push({l:"Billing amounts > 0",met:(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0)>0});}
  if(s==="Order Confirmed"){g.push({l:"Billing amounts > 0",met:(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0)>0});g.push({l:"1+ service selected",met:(p.services||[]).length>0});}
  if(s==="Welcome Sent"){g.push({l:"Welcome email task complete",met:!!(p.tasks?.ca_welcome_email?.done)});g.push({l:"Site survey status set",met:!!(p.siteSurvey?.required===false||p.siteSurvey?.status==="Not Needed"||(p.siteSurvey?.required&&p.siteSurvey?.status))});g.push({l:"PM assigned",met:!!p.assignedPM});}
  if(s==="Plan"){g.push({l:"Install date set",met:!!p.installDate});g.push({l:"Installer assigned",met:!!p.assignedInstaller});}
  if(s==="Kickoff Scheduled"){g.push({l:"Kickoff logged in contact log",met:!!(p.contactLog||[]).some(l=>l.type==="Call"&&l.linkedStage==="Kickoff Call Complete")});}
  if(s==="Kickoff Complete"){g.push({l:"Port numbers documented",met:!!p.portNumbers});g.push({l:"Port date confirmed",met:!!p.portDate});}
  if(s==="Port Ordered"){g.push({l:"Install date set",met:!!p.installDate});g.push({l:"Customer confirmation logged",met:!!(p.contactLog||[]).some(l=>l.linkedStage==="Install Date Confirmed")});}
  if(s==="Install & Port Date Set"){g.push({l:"Equipment reserved",met:Object.values(p.inventory||{}).every(v=>v.required===0||v.reserved>=v.required)});g.push({l:"Installer confirmed",met:!!p.assignedInstaller});}
  if(s==="Training Complete"){const gl=p.goLiveChecklist||{};g.push({l:"Go-Live Checklist 100%",met:Object.values(gl).length>0&&Object.values(gl).every(Boolean)});}
  if(s==="Activation Ready"){g.push({l:"Payment confirmed",met:!!(p.billing?.equipPaymentDate)});}
  if(s==="Client Activated"){const sh=p.supportHandoff||{};g.push({l:"Support Handoff complete",met:!!(sh.primaryContact&&sh.escalationContact&&sh.openIssuesConfirmed&&sh.monthlyReviewScheduled)});}
  if(s==="Survey Scheduled"){g.push({l:"Survey date set",met:!!p.siteSurvey?.date});g.push({l:"Tech assigned",met:!!p.siteSurvey?.tech});}
  if(s==="Survey Complete"){g.push({l:"Report attached",met:!!p.siteSurvey?.reportAttached});g.push({l:"Scope change noted",met:p.siteSurvey?.scopeChanged!==undefined});g.push({l:"Readiness set",met:!!p.siteSurvey?.readiness});}
  if(s==="Survey Approved"){g.push({l:"Scope approved by Accounting",met:!!p.accScopeLocked});g.push({l:"Equipment reserved",met:Object.values(p.inventory||{}).some(v=>v.reserved>0)});}
  if(s==="Install Scheduled"){g.push({l:"Equipment on-site (check-in)",met:!!p.installerCheckedIn});}
  if(s==="Installing"){g.push({l:"All lines tested",met:!!(p.tasks?.ins_lines_tested?.done)});g.push({l:"Install report submitted",met:!!(p.tasks?.ins_report?.done)});g.push({l:"PM notified",met:!!(p.tasks?.ins_pm_notified?.done)});}
  if(s==="Scope Review"){g.push({l:"Scope locked",met:!!p.accScopeLocked});}
  if(s==="Equipment Invoiced"){g.push({l:"Payment recorded (method+amount)",met:!!(p.billing?.equipPaymentDate&&p.billing?.equipPaymentMethod)});}
  if(s==="Payment Confirmed"){g.push({l:"Install confirmed by installer",met:!!(p.tasks?.ins_report?.done)});}
  if(s==="Install Invoiced"){g.push({l:"Install invoice date set",met:!!p.billing?.installInvoiceDate});g.push({l:"Install payment confirmed",met:!!p.billing?.installPaymentDate});}
  return g;
}
const canAdvance = p => getGates(p).every(g=>g.met);

// ── Defaults ──────────────────────────────────────────────────────────────────
const defaultTasks = () => ({
  ca_welcome_email:{done:false,note:"",completedDate:"",label:"Send Welcome Email"},
  ca_confirm_call:{done:false,note:"",completedDate:"",label:"Schedule Confirmation Call"},
  ca_call_complete:{done:false,note:"",completedDate:"",label:"Complete Confirmation Call"},
  ca_handoff_pm:{done:false,note:"",completedDate:"",label:"Hand Off to PM"},
  pm_project_plan:{done:false,note:"",completedDate:"",label:"Create Project Plan"},
  pm_kickoff:{done:false,note:"",completedDate:"",label:"Kickoff Call Complete"},
  pm_training:{done:false,note:"",completedDate:"",label:"Training Scheduled"},
  ins_schedule_survey:{done:false,note:"",completedDate:"",label:"Schedule Site Survey"},
  ins_complete_survey:{done:false,note:"",completedDate:"",label:"Complete Site Survey"},
  ins_survey_report:{done:false,note:"",completedDate:"",label:"Submit Survey Report"},
  ins_lines_tested:{done:false,note:"",completedDate:"",label:"All Lines Tested"},
  ins_report:{done:false,note:"",completedDate:"",label:"Install Report Submitted"},
  ins_pm_notified:{done:false,note:"",completedDate:"",label:"PM Notified of Completion"},
  acc_send_invoice:{done:false,note:"",completedDate:"",label:"Send Invoice"},
  acc_confirm_payment:{done:false,note:"",completedDate:"",label:"Confirm Payment Received"},
});
const defaultInventory = () => ({});
const defaultGoLive = () => ({allPhonesProvisioned:false,portConfirmed:false,inboundCallsTested:false,outboundCallsTested:false,voicemailConfigured:false,autoAttendantTested:false,adminTrainingComplete:false,userTrainingComplete:false,customerSignoff:false});

// ── Staff Data Model ──────────────────────────────────────────────────────────
let staffIdSeq = 10;
function mkStaff(ov) {
  return { id:"st_"+(staffIdSeq++), name:"", roles:[], email:"", phone:"", active:true, notes:"", ...ov };
}

const STAFF0 = [
  mkStaff({id:"st_1",name:"Sarah Mitchell", roles:["Project Manager","Contract Admin"], email:"sarah@vaspian.com", phone:"716-555-0011", active:true}),
  mkStaff({id:"st_2",name:"Mike Torres",    roles:["Project Manager","Sales"],           email:"mike@vaspian.com",  phone:"716-555-0022", active:true}),
  mkStaff({id:"st_3",name:"Dave Kowalski",  roles:["Installer"],                         email:"dave@vaspian.com",  phone:"716-555-0033", active:true}),
  mkStaff({id:"st_4",name:"Luis Reyes",     roles:["Installer"],                         email:"luis@vaspian.com",  phone:"716-555-0044", active:true}),
  mkStaff({id:"st_5",name:"Diana Park",     roles:["Accounting"],                        email:"diana@vaspian.com", phone:"716-555-0055", active:true}),
  mkStaff({id:"st_6",name:"Mike Chen",      roles:["Contract Admin"],                    email:"mchen@vaspian.com", phone:"716-555-0066", active:true}),
  mkStaff({id:"st_7",name:"Jake Harper",    roles:["Sales"],                             email:"jake@vaspian.com",  phone:"716-555-0077", active:true}),
];

// ── Customer + Project Models ─────────────────────────────────────────────────
let custIdSeq=10, projIdSeq=20;
function defaultProject(ov={}) {
  return { id:0,customerId:0,name:"Phase 1 Install",stage:"CRM Entry",stageEnteredDate:todayStr,stageHistory:[],services:[],lines:1,zohoDealId:"",zohoLinked:false,assignedCA:"",assignedPM:"",assignedInstaller:"",assignedAccounting:"",tasks:defaultTasks(),contactLog:[],siteSurvey:{required:false,status:"Not Needed",date:"",tech:"",scopeChanged:undefined,scopeNotes:"",readiness:"Ready",issues:"",approvedBy:"",approvedDate:"",reportAttached:false},inventory:defaultInventory(),billing:{equipInvoiceId:"",equipInvoiceDate:"",equipInvoiceAmount:0,equipPaymentDate:"",equipPaymentMethod:"",installInvoiceId:"",installInvoiceDate:"",installInvoiceAmount:0,installPaymentDate:"",invoiced:false,paid:false},goLiveChecklist:defaultGoLive(),supportHandoff:{primaryContact:"",escalationContact:"",openIssuesConfirmed:false,specialInstructions:"",monthlyReviewScheduled:false},installDate:"",portDate:"",portNumbers:"",notes:"",riskBlocked:false,installerCheckedIn:false,accScopeLocked:false,archived:false,documents:[],createdDate:todayStr,...ov };
}
function defaultCustomer(ov={}) {
  return { id:0,company:"",contact:"",phone:"",email:"",address:"",rep:"",zohoAccountId:"",notes:"",createdDate:todayStr,tags:[],...ov };
}

const CUSTOMERS0 = [
  defaultCustomer({id:1,company:"ABC Law Firm",contact:"John Smith",phone:"716-555-0101",email:"jsmith@abclaw.com",rep:"Jake Harper",zohoAccountId:"ZA-001",createdDate:"2026-03-01"}),
  defaultCustomer({id:2,company:"Main St Dental",contact:"Sara Lee",phone:"716-555-0202",email:"slee@mainst.com",rep:"Sarah Mitchell",zohoAccountId:"ZA-002",createdDate:"2026-03-10"}),
  defaultCustomer({id:3,company:"Lakeside Auto",contact:"Tom Rivera",phone:"716-555-0303",rep:"Jake Harper",createdDate:"2026-03-30"}),
  defaultCustomer({id:4,company:"WNY Realty",contact:"Amy Chen",phone:"716-555-0404",email:"achen@wnyr.com",rep:"Sarah Mitchell",zohoAccountId:"ZA-004",createdDate:"2026-02-15"}),
  defaultCustomer({id:5,company:"Buffalo Brewing Co",contact:"Nick Wade",phone:"716-555-0505",rep:"Mike Torres",zohoAccountId:"ZA-005",createdDate:"2026-03-20"}),
  defaultCustomer({id:6,company:"Erie County Clinic",contact:"Dr. Patel",phone:"716-555-0606",rep:"Sarah Mitchell",zohoAccountId:"ZA-006",createdDate:"2026-01-10"}),
  defaultCustomer({id:7,company:"Niagara Hotel Group",contact:"Beth Moore",phone:"716-555-0707",rep:"Mike Torres",zohoAccountId:"ZA-007",createdDate:"2026-03-15"}),
];

const PROJECTS0 = [
  defaultProject({id:1,customerId:1,name:"Phone + Dialer Install",stage:"Installing",stageEnteredDate:"2026-03-26",services:["Phone","Dialer"],lines:12,zohoDealId:"ZD-1001",zohoLinked:true,assignedPM:"Sarah Mitchell",assignedInstaller:"Dave Kowalski",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",installDate:"2026-04-08",portDate:"2026-04-08",portNumbers:"716-555-0101..0112",billing:{equipInvoiceAmount:1000,installInvoiceAmount:600,equipInvoiceDate:"2026-03-28",equipPaymentDate:"2026-04-01",equipPaymentMethod:"ACH",invoiced:true,paid:true},siteSurvey:{required:false,status:"Not Needed",date:"",tech:"",scopeChanged:false,scopeNotes:"",readiness:"Ready",issues:"",approvedBy:"",approvedDate:"",reportAttached:false},accScopeLocked:true,installerCheckedIn:true,contactLog:[{id:"cl1",date:"2026-03-22",type:"Call",author:"Sarah Mitchell",text:"Kickoff complete.",linkedStage:"Kickoff Call Complete"},{id:"cl2",date:"2026-03-25",type:"Email",author:"Sarah Mitchell",text:"Customer confirmed install.",linkedStage:"Install Date Confirmed"}],tasks:{...defaultTasks(),ca_welcome_email:{done:true,note:"",completedDate:"2026-03-20",label:"Send Welcome Email"},ca_handoff_pm:{done:true,note:"",completedDate:"2026-03-23",label:"Hand Off to PM"},pm_project_plan:{done:true,note:"",completedDate:"2026-03-24",label:"Create Project Plan"},pm_kickoff:{done:true,note:"",completedDate:"2026-03-22",label:"Kickoff Call Complete"},acc_send_invoice:{done:true,note:"",completedDate:"2026-03-28",label:"Send Invoice"},acc_confirm_payment:{done:true,note:"",completedDate:"2026-04-01",label:"Confirm Payment Received"}},documents:[{id:"d1",name:"Signed Contract - ABC Law Firm.pdf",type:"contract",date:"2026-03-18",size:"245 KB"}]}),
  defaultProject({id:2,customerId:1,name:"Speech Analytics Add-On",stage:"CRM Entry",stageEnteredDate:"2026-04-01",services:["Speech Analytics"],lines:12,zohoDealId:"ZD-1009",zohoLinked:true,assignedCA:"Mike Chen",billing:{equipInvoiceAmount:900,installInvoiceAmount:0,invoiced:false,paid:false},documents:[]}),
  defaultProject({id:3,customerId:2,name:"Phone + Text Install",stage:"Install Scheduled",stageEnteredDate:"2026-03-28",services:["Phone","Text"],lines:6,zohoDealId:"ZD-1002",zohoLinked:true,assignedPM:"Sarah Mitchell",assignedInstaller:"Dave Kowalski",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",installDate:"2026-04-05",portDate:"2026-04-05",portNumbers:"716-555-0202..0207",billing:{equipInvoiceAmount:540,installInvoiceAmount:300,equipInvoiceDate:"2026-03-29",invoiced:false,paid:false},siteSurvey:{required:true,status:"Completed",date:"2026-03-30",tech:"Dave Kowalski",scopeChanged:false,scopeNotes:"All clear",readiness:"Ready",issues:"",approvedBy:"Sarah Mitchell",approvedDate:"2026-03-31",reportAttached:true},accScopeLocked:true,installerCheckedIn:false,riskBlocked:true,contactLog:[{id:"cl3",date:"2026-03-22",type:"Call",author:"Sarah Mitchell",text:"Kickoff complete.",linkedStage:"Kickoff Call Complete"},{id:"cl4",date:"2026-03-28",type:"Email",author:"Sarah Mitchell",text:"Install date confirmed.",linkedStage:"Install Date Confirmed"}],documents:[{id:"d2",name:"Site Survey Report.pdf",type:"survey",date:"2026-03-30",size:"128 KB"}]}),
  defaultProject({id:4,customerId:3,name:"Basic Phone Setup",stage:"CRM Entry",stageEnteredDate:"2026-03-30",services:[],lines:4,billing:{equipInvoiceAmount:0,installInvoiceAmount:0,invoiced:false,paid:false},documents:[]}),
  defaultProject({id:5,customerId:4,name:"Full UC Install",stage:"Closed",stageEnteredDate:"2026-03-28",services:["Phone","Soft Phone","Text"],lines:20,zohoDealId:"ZD-1004",zohoLinked:true,archived:true,assignedPM:"Sarah Mitchell",assignedInstaller:"Luis Reyes",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",installDate:"2026-03-28",billing:{equipInvoiceAmount:2000,installInvoiceAmount:800,equipInvoiceDate:"2026-03-22",equipPaymentDate:"2026-03-25",equipPaymentMethod:"Check",installInvoiceDate:"2026-03-29",installPaymentDate:"2026-04-01",invoiced:true,paid:true},documents:[{id:"d3",name:"WNY Realty - Signed Agreement.pdf",type:"contract",date:"2026-03-15",size:"312 KB"}]}),
  defaultProject({id:6,customerId:5,name:"Phone System Install",stage:"Survey Scheduled",stageEnteredDate:"2026-03-29",services:["Phone"],lines:8,zohoDealId:"ZD-1005",zohoLinked:true,assignedPM:"Mike Torres",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",billing:{equipInvoiceAmount:800,installInvoiceAmount:400,invoiced:false,paid:false},siteSurvey:{required:true,status:"Required",date:"",tech:"",scopeChanged:undefined,scopeNotes:"",readiness:"",issues:"",approvedBy:"",approvedDate:"",reportAttached:false},riskBlocked:true,documents:[]}),
  defaultProject({id:7,customerId:6,name:"Phone + Soft Phone + Analytics",stage:"Closed",stageEnteredDate:"2026-03-15",services:["Phone","Soft Phone","Speech Analytics"],lines:30,zohoDealId:"ZD-1006",zohoLinked:true,archived:true,assignedPM:"Sarah Mitchell",assignedInstaller:"Dave Kowalski",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",billing:{equipInvoiceAmount:2800,installInvoiceAmount:1200,equipPaymentDate:"2026-03-10",equipPaymentMethod:"Wire",installPaymentDate:"2026-03-18",invoiced:true,paid:true},documents:[{id:"d5",name:"Erie County - MSA.pdf",type:"contract",date:"2026-01-20",size:"445 KB"}]}),
  defaultProject({id:8,customerId:7,name:"Hotel PBX Migration",stage:"Kickoff Complete",stageEnteredDate:"2026-03-25",services:["Phone","Soft Phone"],lines:45,zohoDealId:"ZD-1007",zohoLinked:true,assignedPM:"Mike Torres",assignedCA:"Mike Chen",assignedAccounting:"Diana Park",billing:{equipInvoiceAmount:0,installInvoiceAmount:0,invoiced:false,paid:false},contactLog:[{id:"cl5",date:"2026-03-28",type:"Call",author:"Mike Torres",text:"Kickoff complete.",linkedStage:"Kickoff Call Complete"}],riskBlocked:true,documents:[]}),
];

// ── Inventory Catalog ─────────────────────────────────────────────────────────
const ITEM_CATEGORIES = ["Phone","Conference Phone","Router","Switch","Cabling Kit","DID Block","Accessory"];
const CAT_ICON  = {"Phone":"📞","Conference Phone":"🔊","Router":"🔌","Switch":"⚡","Cabling Kit":"🔧","DID Block":"#️⃣","Accessory":"🔩"};
const CAT_COLOR = {"Phone":"#60a5fa","Conference Phone":"#a78bfa","Router":"#34d399","Switch":"#fbbf24","Cabling Kit":"#fb923c","DID Block":"#38bdf8","Accessory":"#94a3b8"};
let itemIdSeq = 40;
function mkItem(ov) { return {id:"itm_"+(itemIdSeq++),category:"Phone",model:"",condition:"new",sku:"",totalQty:0,reserved:0,staged:0,low:5,unitCost:0,notes:"",active:true,...ov}; }

const INV_CATALOG0 = [
  mkItem({id:"itm_1",category:"Phone",model:"MiVoice 6940 IP Phone",condition:"new",sku:"MIV-6940-N",totalQty:12,low:4,unitCost:349,notes:"Top-of-line"}),
  mkItem({id:"itm_2",category:"Phone",model:"MiVoice 6940 IP Phone",condition:"refurbished",sku:"MIV-6940-R",totalQty:5,low:2,unitCost:199}),
  mkItem({id:"itm_3",category:"Phone",model:"MiVoice 6930 IP Phone",condition:"new",sku:"MIV-6930-N",totalQty:15,low:5,unitCost:299}),
  mkItem({id:"itm_4",category:"Phone",model:"MiVoice 6930 IP Phone",condition:"refurbished",sku:"MIV-6930-R",totalQty:8,low:3,unitCost:169}),
  mkItem({id:"itm_5",category:"Phone",model:"MiVoice 6920 IP Phone",condition:"new",sku:"MIV-6920-N",totalQty:18,low:5,unitCost:249}),
  mkItem({id:"itm_6",category:"Phone",model:"MiVoice 6920 IP Phone",condition:"refurbished",sku:"MIV-6920-R",totalQty:10,low:3,unitCost:139}),
  mkItem({id:"itm_7",category:"Phone",model:"MiVoice 5360 IP Phone",condition:"new",sku:"MIV-5360-N",totalQty:10,low:3,unitCost:279}),
  mkItem({id:"itm_8",category:"Phone",model:"MiVoice 5340e IP Phone",condition:"new",sku:"MIV-5340E-N",totalQty:14,low:4,unitCost:229}),
  mkItem({id:"itm_9",category:"Phone",model:"MiVoice 5330e IP Phone",condition:"new",sku:"MIV-5330E-N",totalQty:20,low:5,unitCost:199}),
  mkItem({id:"itm_10",category:"Phone",model:"MiVoice 5330e IP Phone",condition:"refurbished",sku:"MIV-5330E-R",totalQty:9,low:3,unitCost:109}),
  mkItem({id:"itm_11",category:"Phone",model:"MiVoice 5320e IP Phone",condition:"new",sku:"MIV-5320E-N",totalQty:22,low:6,unitCost:179}),
  mkItem({id:"itm_12",category:"Phone",model:"MiVoice 5320e IP Phone",condition:"refurbished",sku:"MIV-5320E-R",totalQty:11,low:3,unitCost:99}),
  mkItem({id:"itm_13",category:"Phone",model:"MiVoice 5324 IP Phone",condition:"new",sku:"MIV-5324-N",totalQty:16,low:4,unitCost:169}),
  mkItem({id:"itm_14",category:"Phone",model:"MiVoice 5312 IP Phone",condition:"new",sku:"MIV-5312-N",totalQty:18,low:5,unitCost:149}),
  mkItem({id:"itm_15",category:"Phone",model:"MiVoice 5304 IP Phone",condition:"new",sku:"MIV-5304-N",totalQty:25,low:6,unitCost:119,notes:"Budget entry model"}),
  mkItem({id:"itm_16",category:"Phone",model:"MiVoice 5304 IP Phone",condition:"refurbished",sku:"MIV-5304-R",totalQty:12,low:4,unitCost:65}),
  mkItem({id:"itm_17",category:"Conference Phone",model:"MiVoice Conference Unit",condition:"new",sku:"MIV-CONF-N",totalQty:6,low:2,unitCost:399}),
  mkItem({id:"itm_18",category:"Conference Phone",model:"FLX Wireless Conference Phone",condition:"new",sku:"FLX-WIRELESS-N",totalQty:5,low:2,unitCost:459}),
  mkItem({id:"itm_19",category:"Conference Phone",model:"FLX UC 1000 Conference Phone",condition:"new",sku:"FLX-UC1000-N",totalQty:4,low:2,unitCost:349}),
  mkItem({id:"itm_20",category:"Accessory",model:"Mitel Bluetooth Module & Handset",condition:"new",sku:"MIT-BT-MOD-N",totalQty:8,low:3,unitCost:189}),
  mkItem({id:"itm_21",category:"Accessory",model:"Receptionist Console",condition:"new",sku:"MIT-RCPT-CON-N",totalQty:4,low:2,unitCost:329,notes:"96 programmable keys"}),
  mkItem({id:"itm_22",category:"Accessory",model:"Receptionist Console",condition:"refurbished",sku:"MIT-RCPT-CON-R",totalQty:2,low:1,unitCost:185}),
  mkItem({id:"itm_23",category:"Router",model:"Cradlepoint E3000",condition:"new",sku:"CP-E3000-N",totalQty:6,low:2,unitCost:450}),
  mkItem({id:"itm_24",category:"Router",model:"Cradlepoint IBR900",condition:"new",sku:"CP-IBR900-N",totalQty:4,low:2,unitCost:380}),
  mkItem({id:"itm_25",category:"Switch",model:"Cisco SG350-10",condition:"new",sku:"CS-SG350-N",totalQty:5,low:2,unitCost:210}),
  mkItem({id:"itm_26",category:"Switch",model:"Cisco SG350-10",condition:"refurbished",sku:"CS-SG350-R",totalQty:3,low:1,unitCost:120}),
  mkItem({id:"itm_27",category:"Cabling Kit",model:"Standard Cat6 Kit",condition:"new",sku:"CAB-CAT6-STD",totalQty:20,low:5,unitCost:65}),
  mkItem({id:"itm_28",category:"DID Block",model:"DID Numbers (block of 10)",condition:"new",sku:"DID-BLK10",totalQty:30,low:5,unitCost:20}),
];

function syncCatalog(projects,catalog) {
  return catalog.map(item=>({...item,reserved:projects.reduce((a,p)=>a+(p.inventory?.[item.id]?.reserved||0),0),staged:projects.reduce((a,p)=>a+(p.inventory?.[item.id]?.staged||0),0)}));
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  app:{fontFamily:"system-ui,sans-serif",background:"#0a0f1e",minHeight:"100vh",color:"#e2e8f0"},
  nav:{background:"#111827",borderBottom:"1px solid #1e2d45",padding:"0 10px",display:"flex",alignItems:"center",gap:0,flexWrap:"wrap",position:"sticky",top:0,zIndex:100},
  page:{padding:14,maxWidth:1400,margin:"0 auto"},
  card:{background:"#111827",borderRadius:10,border:"1px solid #1e2d45",overflow:"hidden",marginBottom:12},
  cardH:{padding:"10px 14px",borderBottom:"1px solid #1e2d45",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8},
  tbl:{width:"100%",borderCollapse:"collapse",fontSize:12},
  th:{padding:"7px 11px",textAlign:"left",fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",borderBottom:"1px solid #1e2d45",whiteSpace:"nowrap"},
  td:{padding:"8px 11px",borderBottom:"1px solid #0d1628",verticalAlign:"middle"},
  inp:{background:"#0d1628",border:"1px solid #1e2d45",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontSize:13,width:"100%",boxSizing:"border-box"},
  sel:{background:"#0d1628",border:"1px solid #1e2d45",borderRadius:6,padding:"7px 10px",color:"#e2e8f0",fontSize:13,width:"100%",boxSizing:"border-box"},
  lbl:{fontSize:11,color:"#6b7280",marginBottom:3,display:"block"},
  btn:(c,tc)=>({background:c||"#3b82f6",color:tc||"#fff",border:"none",borderRadius:6,padding:"7px 13px",fontSize:12,fontWeight:600,cursor:"pointer"}),
  outBtn:{background:"transparent",color:"#94a3b8",border:"1px solid #1e2d45",borderRadius:6,padding:"6px 11px",fontSize:12,cursor:"pointer"},
  badge:c=>({background:c+"20",color:c,borderRadius:4,padding:"2px 7px",fontSize:10,fontWeight:700,display:"inline-block",whiteSpace:"nowrap"}),
  alert:c=>({background:c+"12",border:"1px solid "+c+"33",borderLeft:"3px solid "+c,borderRadius:6,padding:"8px 12px",marginBottom:8,fontSize:12,color:c}),
  sechdr:{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",letterSpacing:.5,marginBottom:8,paddingBottom:5,borderBottom:"1px solid #1e2d45"},
  grid2:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:11},
  grid3:{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:11},
  flexWrap:{display:"flex",flexWrap:"wrap",gap:10},
  overlay:{position:"fixed",inset:0,background:"#00000099",display:"flex",alignItems:"center",justifyContent:"center"},
  modalBox:(w)=>({background:"#111827",borderRadius:12,border:"1px solid #1e2d45",width:w||560,maxWidth:"95vw",maxHeight:"93vh",overflowY:"auto"}),
};
const tabStyle = a=>({padding:"12px 8px",fontWeight:600,fontSize:11,cursor:"pointer",color:a?"#38bdf8":"#4b5563",background:"none",border:"none",borderBottom:"2px solid "+(a?"#38bdf8":"transparent"),outline:"none",whiteSpace:"nowrap"});

// ── Modal Wrapper ─────────────────────────────────────────────────────────────
function Modal({zIndex,width,onClose,children}){
  return <div style={{...S.overlay,zIndex:zIndex||999}} onClick={e=>{if(e.target===e.currentTarget&&onClose)onClose();}}>
    <div style={{...S.modalBox(width),padding:24}}>{children}</div>
  </div>;
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function StatCard({l,v,c,onClick}){return <div onClick={onClick} style={{background:c+"15",border:"1px solid "+c+"30",borderRadius:8,padding:"10px 14px",minWidth:110,flex:"1 1 110px",cursor:onClick?"pointer":"default"}}><div style={{fontSize:20,fontWeight:800,color:"#f1f5f9"}}>{v}</div><div style={{fontSize:11,color:c,marginTop:2,fontWeight:600}}>{l}</div></div>;}
function StageBadge({stage}){const c=SC[stage]||"#64748b";return <span style={S.badge(c)}>{stage}</span>;}
function RiskBadge({score}){const c=riskColor(score);return <span style={{...S.badge(c),fontWeight:800}}>{score}</span>;}
function SvcBadge({sv}){const c=SVC_COLOR[sv]||"#64748b";return <span style={{...S.badge(c),marginRight:2,marginBottom:2}}>{sv}</span>;}
function AgingPill({p}){const lim=BOTTLENECK[p.stage];if(!lim||!p.stageEnteredDate)return null;const age=daysSince(p.stageEnteredDate);if(age<lim)return null;const c=age>=lim*2?"#f87171":"#fbbf24";return <span style={{...S.badge(c),marginLeft:4}}>⏱{age}d</span>;}
function ProgressBar({pct,stage}){const c=pct===100?"#4ade80":pct>=60?"#38bdf8":pct>=30?"#fbbf24":"#f87171";return <div style={{minWidth:100}}><div style={{background:"#0d1628",borderRadius:999,height:6,overflow:"hidden",marginBottom:2}}><div style={{width:pct+"%",height:"100%",background:c,borderRadius:999}}/></div><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:9,color:"#4b5563",overflow:"hidden",maxWidth:90,whiteSpace:"nowrap",textOverflow:"ellipsis"}}>{stage}</span><span style={{fontSize:9,fontWeight:700,color:c}}>{pct}%</span></div></div>;}

// ── Scope Toggle ──────────────────────────────────────────────────────────────
function ScopeToggle({scope,setScope,label}){
  return <div style={{display:"flex",alignItems:"center",gap:0,background:"#0d1628",borderRadius:7,border:"1px solid #1e2d45",overflow:"hidden",flexShrink:0}}>
    {[["mine",label||"This Stage"],["all","All Projects"]].map(([v,l])=>(
      <button key={v} onClick={()=>setScope(v)} style={{padding:"6px 13px",fontSize:11,fontWeight:600,cursor:"pointer",border:"none",borderRadius:0,background:scope===v?"#1e3a5f":"transparent",color:scope===v?"#38bdf8":"#4b5563"}}>{l}</button>
    ))}
  </div>;
}

// ── View Toggle (Kanban / List) ───────────────────────────────────────────────
function ViewToggle({view,setView}){
  return <div style={{display:"flex",gap:0,background:"#0d1628",borderRadius:7,border:"1px solid #1e2d45",overflow:"hidden",flexShrink:0}}>
    {[["kanban","📋 Kanban"],["list","☰ List"]].map(([v,l])=>(
      <button key={v} onClick={()=>setView(v)} style={{padding:"6px 12px",fontSize:11,fontWeight:600,cursor:"pointer",border:"none",borderRadius:0,background:view===v?"#1e3a5f":"transparent",color:view===v?"#38bdf8":"#4b5563"}}>{l}</button>
    ))}
  </div>;
}

// ── Staff Dropdown (role-filtered) ────────────────────────────────────────────
function StaffSelect({value, onChange, staff, roleFilter, label, placeholder}){
  const opts = staff.filter(s=>s.active&&(!roleFilter||s.roles.includes(roleFilter)));
  return <div>
    {label&&<label style={S.lbl}>{label}</label>}
    <select style={S.sel} value={value||""} onChange={e=>onChange(e.target.value)}>
      <option value="">{placeholder||"— Unassigned —"}</option>
      {opts.map(s=><option key={s.id} value={s.name}>{s.name}</option>)}
    </select>
  </div>;
}

// ── Filter Bar ────────────────────────────────────────────────────────────────
function FilterBar({filters, setFilters, staff, roleKey, stageOptions, extraResetFields}){
  const ss={...S.sel,padding:"5px 8px",fontSize:11};
  const assignees = staff.filter(s=>s.active&&(!roleKey||s.roles.includes(roleKey)));
  function reset(){setFilters(f=>({...f,search:"",assignee:"All",risk:"All",stage:"All",...(extraResetFields||{})}));}
  return <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
    <div style={{flex:"2 1 150px"}}><label style={S.lbl}>Search</label><input style={{...S.inp,fontSize:12}} placeholder="Customer, project…" value={filters.search||""} onChange={e=>setFilters(f=>({...f,search:e.target.value}))}/></div>
    {assignees.length>0&&<div style={{flex:"1 1 130px"}}><label style={S.lbl}>{roleKey||"Assigned"}</label><select style={ss} value={filters.assignee||"All"} onChange={e=>setFilters(f=>({...f,assignee:e.target.value}))}><option>All</option>{assignees.map(s=><option key={s.id}>{s.name}</option>)}</select></div>}
    <div style={{flex:"1 1 100px"}}><label style={S.lbl}>Risk</label><select style={ss} value={filters.risk||"All"} onChange={e=>setFilters(f=>({...f,risk:e.target.value}))}>{["All","Critical","At Risk","On Track"].map(v=><option key={v}>{v}</option>)}</select></div>
    {stageOptions&&<div style={{flex:"1 1 130px"}}><label style={S.lbl}>Stage</label><select style={ss} value={filters.stage||"All"} onChange={e=>setFilters(f=>({...f,stage:e.target.value}))}><option>All</option>{stageOptions.map(v=><option key={v}>{v}</option>)}</select></div>}
    <button style={S.outBtn} onClick={reset}>Reset</button>
  </div>;
}

function applyFilters(projects, filters, assigneeField, customers){
  const q=(filters.search||"").toLowerCase();
  return projects.filter(p=>{
    if(q){const cust=customers?.find(c=>c.id===p.customerId);if(!(cust?.company||"").toLowerCase().includes(q)&&!p.name.toLowerCase().includes(q))return false;}
    if(filters.assignee&&filters.assignee!=="All"&&p[assigneeField]!==filters.assignee)return false;
    if(filters.stage&&filters.stage!=="All"&&p.stage!==filters.stage)return false;
    const s=calcRisk(p).score;
    if(filters.risk==="Critical"&&s<50)return false;
    if(filters.risk==="At Risk"&&(s<25||s>=50))return false;
    if(filters.risk==="On Track"&&s>=25)return false;
    return true;
  });
}

// ── CSV Export ────────────────────────────────────────────────────────────────
function exportCSV(rows,filename){if(!rows.length)return;const keys=Object.keys(rows[0]);const csv=[keys.join(","),...rows.map(r=>keys.map(k=>{const v=r[k];if(v==null)return"";const s=String(v).replace(/"/g,'""');return s.includes(",")||s.includes('"')||s.includes('\n')?`"${s}"`:s;}).join(","))].join("\n");const blob=new Blob([csv],{type:"text/csv"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=filename+".csv";a.click();URL.revokeObjectURL(url);}

// ── Zoho Import Modal ─────────────────────────────────────────────────────────
const FAKE_ZOHO={"ZD-2001":{company:"Lockport Medical Group",contact:"Dr. Kim Lee",phone:"716-555-1001",rep:"Jake Harper",services:["Phone","Text"],lines:15,equipInvoiceAmount:1350,installInvoiceAmount:500,notes:"Urgent migration from legacy PBX."},"ZD-2002":{company:"Buffalo Tech Hub",contact:"Marcus Reed",phone:"716-555-2002",rep:"Sarah Mitchell",services:["Phone","Soft Phone","Speech Analytics"],lines:25,equipInvoiceAmount:2250,installInvoiceAmount:900,notes:"Startup, flexible on timing."}};
function ZohoImportModal({onImport,onClose}){
  const [dealId,setDealId]=useState("");const [status,setStatus]=useState("idle");const [result,setResult]=useState(null);
  function doFetch(){if(!dealId.trim())return;setStatus("loading");setTimeout(()=>{const r=FAKE_ZOHO[dealId.trim().toUpperCase()];if(r){setResult({...r,zohoDealId:dealId.trim().toUpperCase()});setStatus("found");}else setStatus("notfound");},800);}
  return <Modal zIndex={1100} width={500} onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontWeight:800,fontSize:15,color:"#38bdf8"}}>🔗 Import from Zoho CRM</span><button style={S.outBtn} onClick={onClose}>✕</button></div>
      <div style={S.alert("#38bdf8")}>Enter a Zoho Deal ID. Try ZD-2001 or ZD-2002.</div>
      <div style={{display:"flex",gap:8,marginTop:10,marginBottom:12}}><input style={{...S.inp,flex:1}} placeholder="e.g. ZD-2001" value={dealId} onChange={e=>setDealId(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doFetch()}/><button style={S.btn()} onClick={doFetch}>{status==="loading"?"…":"Fetch Deal"}</button></div>
      {status==="notfound"&&<div style={S.alert("#f87171")}>Not found.</div>}
      {status==="found"&&result&&<div>
        <div style={{background:"#0d1628",borderRadius:8,padding:14,marginBottom:12}}>
          <div style={{fontWeight:700,color:"#4ade80",marginBottom:8}}>✓ {result.zohoDealId}</div>
          <div style={S.grid2}>{[["Company",result.company],["Contact",result.contact],["Lines",result.lines],["Equip $",f$(result.equipInvoiceAmount)]].map(([l,v])=><div key={l}><span style={{fontSize:10,color:"#4b5563"}}>{l}: </span><span style={{fontSize:12,color:"#f1f5f9",fontWeight:600}}>{v}</span></div>)}</div>
          <div style={{marginTop:8}}>{result.services.map(sv=><SvcBadge key={sv} sv={sv}/>)}</div>
          {result.notes&&<div style={{marginTop:6,fontSize:11,color:"#94a3b8",fontStyle:"italic"}}>"{result.notes}"</div>}
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}><button style={S.outBtn} onClick={onClose}>Cancel</button><button style={S.btn("#4ade80","#000")} onClick={()=>onImport(result)}>✓ Create Project</button></div>
      </div>}
  </Modal>;
}

// ── Document Manager ──────────────────────────────────────────────────────────
const DOC_TYPES=["contract","survey","invoice","report","other"];
const DOC_COLORS={contract:"#4ade80",survey:"#38bdf8",invoice:"#fbbf24",report:"#fb923c",other:"#94a3b8"};
function DocumentManager({docs,onChange}){
  const [adding,setAdding]=useState(false);const [form,setForm]=useState({name:"",type:"contract"});const fileRef=useRef();
  function addDoc(){if(!form.name.trim())return;onChange([...docs,{id:"d_"+Date.now(),name:form.name,type:form.type,date:todayStr,size:"—",uploaded:true}]);setForm({name:"",type:"contract"});setAdding(false);}
  return <div>
    <div style={{...S.sechdr,display:"flex",justifyContent:"space-between",alignItems:"center"}}><span>📎 Documents</span><button style={{...S.btn("#374151"),padding:"3px 9px",fontSize:10}} onClick={()=>setAdding(a=>!a)}>+ Attach</button></div>
    {docs.length===0&&!adding&&<div style={{fontSize:11,color:"#4b5563",marginBottom:8}}>No documents attached.</div>}
    {docs.map(d=><div key={d.id} style={{display:"flex",alignItems:"center",gap:9,background:"#0d1628",borderRadius:6,padding:"7px 10px",marginBottom:5}}>
      <span style={{fontSize:16}}>{d.type==="contract"?"📄":d.type==="survey"?"🔍":d.type==="report"?"📋":d.type==="invoice"?"💰":"📁"}</span>
      <div style={{flex:1}}><div style={{fontSize:12,color:"#f1f5f9",fontWeight:600}}>{d.name}</div><div style={{fontSize:10,color:"#4b5563"}}>{d.date} · {d.size}</div></div>
      <span style={S.badge(DOC_COLORS[d.type]||"#94a3b8")}>{d.type}</span>
      <button style={{background:"transparent",color:"#4b5563",border:"none",cursor:"pointer"}} onClick={()=>onChange(docs.filter(x=>x.id!==d.id))}>✕</button>
    </div>)}
    {adding&&<div style={{background:"#0d1628",borderRadius:7,padding:12,marginBottom:8,border:"1px solid #1e2d45"}}>
      <div style={S.grid2}><div><label style={S.lbl}>Name</label><input style={S.inp} placeholder="Document name…" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/></div><div><label style={S.lbl}>Type</label><select style={S.sel} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>{DOC_TYPES.map(t=><option key={t}>{t}</option>)}</select></div></div>
      <div style={{marginTop:8,display:"flex",gap:7}}><div style={{background:"#1e2d45",borderRadius:5,padding:"6px 10px",fontSize:11,color:"#4b5563",flex:1,border:"1px dashed #334155",cursor:"pointer"}} onClick={()=>fileRef.current?.click()}>📁 Simulate upload</div><input ref={fileRef} type="file" style={{display:"none"}} onChange={e=>{if(e.target.files[0])setForm(f=>({...f,name:e.target.files[0].name}));}}/><button style={S.btn()} onClick={addDoc}>Attach</button><button style={S.outBtn} onClick={()=>setAdding(false)}>Cancel</button></div>
    </div>}
  </div>;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TasksPanel({o,onChange}){
  const groups=[{label:"Contract Admin",color:"#e879f9",icon:"📝",keys:["ca_welcome_email","ca_confirm_call","ca_call_complete","ca_handoff_pm"]},{label:"Project Manager",color:"#38bdf8",icon:"📊",keys:["pm_project_plan","pm_kickoff","pm_training"]},{label:"Installer",color:"#fb923c",icon:"🔧",keys:["ins_schedule_survey","ins_complete_survey","ins_survey_report","ins_lines_tested","ins_report","ins_pm_notified"]},{label:"Accounting",color:"#4ade80",icon:"💰",keys:["acc_send_invoice","acc_confirm_payment"]}];
  const tasks=o.tasks||defaultTasks();
  function toggle(k){const t=tasks[k]||{};onChange({...tasks,[k]:{...t,done:!t.done,completedDate:!t.done?todayStr:""}});}
  return <div>{groups.map(g=>{const defs=g.keys.map(k=>({id:k,...(tasks[k]||{done:false,note:"",completedDate:"",label:k})}));const done=defs.filter(d=>d.done).length;return <div key={g.label} style={{marginBottom:14}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,paddingBottom:5,borderBottom:"1px solid #1e2d45"}}><span>{g.icon}</span><span style={{fontWeight:700,fontSize:12,color:g.color}}>{g.label}</span><span style={{fontSize:10,color:done===g.keys.length?"#4ade80":"#4b5563",marginLeft:"auto"}}>{done}/{g.keys.length}</span></div>{defs.map(d=><div key={d.id} style={{background:d.done?"#0d1628":"#080d1a",border:"1px solid "+(d.done?"#4ade8025":"#1e2d45"),borderRadius:7,padding:"9px 11px",marginBottom:5}}><div style={{display:"flex",gap:9,alignItems:"flex-start"}}><input type="checkbox" checked={!!d.done} onChange={()=>toggle(d.id)} style={{marginTop:2,cursor:"pointer"}}/><div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",gap:6,flexWrap:"wrap"}}><span style={{fontWeight:600,fontSize:12,color:d.done?"#4b5563":"#f1f5f9",textDecoration:d.done?"line-through":"none"}}>{d.label}</span>{d.done&&d.completedDate&&<span style={{fontSize:10,color:"#4b5563"}}>✓ {d.completedDate}</span>}</div><input style={{...S.inp,padding:"4px 7px",fontSize:11,marginTop:5}} placeholder="Note…" value={d.note||""} onChange={e=>{const t=tasks[d.id]||{};onChange({...tasks,[d.id]:{...t,note:e.target.value}});}}/></div></div></div>)}</div>;})}  </div>;
}
function GoLiveChecklist({checklist,onChange}){const items=[["allPhonesProvisioned","All phones provisioned"],["portConfirmed","Port confirmed live"],["inboundCallsTested","Inbound calls tested"],["outboundCallsTested","Outbound calls tested"],["voicemailConfigured","Voicemail configured"],["autoAttendantTested","Auto-attendant tested"],["adminTrainingComplete","Admin training complete"],["userTrainingComplete","User training complete"],["customerSignoff","Customer sign-off"]];const done=items.filter(([k])=>checklist[k]).length;return <div><div style={{...S.sechdr,display:"flex",justifyContent:"space-between"}}><span>🚀 Go-Live</span><span style={{color:done===items.length?"#4ade80":"#f87171"}}>{done}/{items.length}</span></div>{items.map(([k,label])=><label key={k} style={{display:"flex",gap:8,alignItems:"center",fontSize:12,marginBottom:7,cursor:"pointer"}}><input type="checkbox" checked={!!checklist[k]} onChange={e=>onChange({...checklist,[k]:e.target.checked})}/><span style={{color:checklist[k]?"#4ade80":"#f1f5f9",textDecoration:checklist[k]?"line-through":"none"}}>{label}</span></label>)}</div>;}
function SupportHandoff({handoff,onChange}){const u=(k,v)=>onChange({...handoff,[k]:v});return <div><div style={S.alert("#38bdf8")}>📌 Post-activation provisioning — OS tracks the order lifecycle but phone system provisioning runs in parallel through Syl and Silhouette PBX. Verify with the PM and technical team that all provisioning is complete before marking the handoff done. A project reaching "Client Activated" in OS does not guarantee provisioning is finished in Syl or Silhouette.</div><div style={S.sechdr}>🤝 Support Handoff</div><div style={S.grid2}><div><label style={S.lbl}>Primary Contact *</label><input style={S.inp} value={handoff.primaryContact||""} onChange={e=>u("primaryContact",e.target.value)}/></div><div><label style={S.lbl}>Escalation Contact *</label><input style={S.inp} value={handoff.escalationContact||""} onChange={e=>u("escalationContact",e.target.value)}/></div></div><div style={{marginTop:8}}><label style={S.lbl}>Special Instructions</label><textarea style={{...S.inp,height:50,resize:"vertical"}} value={handoff.specialInstructions||""} onChange={e=>u("specialInstructions",e.target.value)}/></div><div style={{display:"flex",gap:16,marginTop:8,flexWrap:"wrap"}}><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!handoff.openIssuesConfirmed} onChange={e=>u("openIssuesConfirmed",e.target.checked)}/>Open issues confirmed</label><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!handoff.monthlyReviewScheduled} onChange={e=>u("monthlyReviewScheduled",e.target.checked)}/>Monthly review scheduled</label></div></div>;}
function ContactLog({p,onChange}){const [form,setForm]=useState({type:"Call",text:"",linkedStage:""});const logs=p.contactLog||[];function add(){if(!form.text.trim())return;onChange([...logs,{id:"cl_"+Date.now(),date:todayStr,type:form.type,author:"Me",text:form.text,linkedStage:form.linkedStage}]);setForm({type:"Call",text:"",linkedStage:""});}const TC={"Call":"#38bdf8","Email":"#a78bfa","Text":"#34d399","Note":"#fbbf24"};return <div><div style={S.sechdr}>📞 Contact Log</div>{logs.length===0&&<div style={{fontSize:11,color:"#4b5563",marginBottom:8}}>No entries yet.</div>}{logs.map(l=><div key={l.id} style={{background:"#0d1628",borderRadius:6,padding:"8px 10px",marginBottom:6,fontSize:11}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:3,flexWrap:"wrap"}}><span style={S.badge(TC[l.type]||"#64748b")}>{l.type}</span><span style={{color:"#4b5563"}}>{l.date}</span><span style={{color:"#94a3b8",fontWeight:600}}>{l.author}</span>{l.linkedStage&&<span style={{...S.badge("#34d399"),fontSize:9}}>🔗{l.linkedStage}</span>}</div><div style={{color:"#e2e8f0"}}>{l.text}</div></div>)}<div style={{display:"grid",gridTemplateColumns:"90px 1fr 160px auto",gap:6,marginTop:8,alignItems:"center"}}><select style={{...S.sel,fontSize:11,padding:"5px 8px"}} value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))}>{["Call","Email","Text","Note"].map(v=><option key={v}>{v}</option>)}</select><input style={{...S.inp,fontSize:11,padding:"5px 8px"}} placeholder="Log entry…" value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))}/><select style={{...S.sel,fontSize:11,padding:"5px 8px"}} value={form.linkedStage} onChange={e=>setForm(p=>({...p,linkedStage:e.target.value}))}><option value="">Link to stage…</option>{["Kickoff Call Complete","Install Date Confirmed","Payment Received","Go-Live Confirmed"].map(v=><option key={v}>{v}</option>)}</select><button style={S.btn()} onClick={add}>+ Add</button></div></div>;}

// ── Project Inventory Picker ──────────────────────────────────────────────────
function ProjectInventoryPicker({inv,catalog,onChange}){
  const [catFilter,setCatFilter]=useState("All");const [search,setSearch]=useState("");const [showAll,setShowAll]=useState(false);
  const u=(id,field,val)=>onChange({...inv,[id]:{...(inv[id]||{required:0,reserved:0,staged:0,delivered:0}),[field]:+val}});
  const allocatedIds=new Set(Object.entries(inv).filter(([,v])=>v.required>0).map(([k])=>k));
  const filtered=useMemo(()=>catalog.filter(item=>{if(!showAll&&!allocatedIds.has(item.id)&&catFilter==="All"&&!search)return false;if(catFilter!=="All"&&item.category!==catFilter)return false;if(search&&!item.model.toLowerCase().includes(search.toLowerCase())&&!item.sku.toLowerCase().includes(search.toLowerCase()))return false;return true;}),[catalog,catFilter,search,showAll,inv]);
  const allocated=catalog.filter(i=>allocatedIds.has(i.id));
  return <div>
    <div style={{...S.sechdr,display:"flex",justifyContent:"space-between"}}><span>📦 Inventory Allocation</span>{Object.values(inv).reduce((a,v)=>a+(v.required||0),0)>0&&<span style={{color:"#4ade80",fontSize:11}}>{Object.values(inv).reduce((a,v)=>a+(v.required||0),0)} units</span>}</div>
    {allocated.length>0&&<div style={{marginBottom:12}}><div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",marginBottom:6}}>Allocated</div><table style={S.tbl}><thead><tr>{["Item","Cond","Req","Res","Stg","Del",""].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{allocated.map(item=>{const row=inv[item.id]||{required:0,reserved:0,staged:0,delivered:0};const short=row.reserved<row.required&&row.required>0;return <tr key={item.id}><td style={S.td}><div style={{fontWeight:600,color:"#f1f5f9",fontSize:12}}>{item.model}</div><div style={{fontSize:9,color:"#4b5563"}}>{item.sku}</div></td><td style={S.td}><span style={S.badge(item.condition==="new"?"#4ade80":"#fbbf24")}>{item.condition==="new"?"New":"Refurb"}</span></td>{["required","reserved","staged","delivered"].map(fk=><td key={fk} style={S.td}><input type="number" style={{...S.inp,width:55,padding:"4px 6px",fontSize:11,borderColor:fk==="reserved"&&short?"#f87171":"#1e2d45"}} value={row[fk]||0} onChange={e=>u(item.id,fk,e.target.value)}/></td>)}<td style={S.td}><button style={{...S.outBtn,padding:"3px 8px",fontSize:11,color:"#f87171"}} onClick={()=>onChange({...inv,[item.id]:{required:0,reserved:0,staged:0,delivered:0}})}>✕</button></td></tr>;})} </tbody></table></div>}
    <div style={{background:"#0d1628",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 12px"}}><div style={{fontSize:11,fontWeight:600,color:"#4b5563",marginBottom:8}}>+ Add from catalog</div><div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}><select style={{...S.sel,padding:"5px 8px",fontSize:11,flex:"1 1 110px"}} value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option>All</option>{ITEM_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select><input style={{...S.inp,padding:"5px 8px",fontSize:11,flex:"2 1 130px"}} placeholder="Search model…" value={search} onChange={e=>setSearch(e.target.value)}/><label style={{fontSize:11,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={showAll} onChange={e=>setShowAll(e.target.checked)}/>All</label></div>{filtered.filter(i=>!allocatedIds.has(i.id)).map(item=>{const avail=item.totalQty-item.reserved;return <div key={item.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 8px",borderRadius:6,marginBottom:4,background:"#111827",border:"1px solid #1e2d45"}}><div style={{flex:1}}><div style={{fontSize:12,fontWeight:600,color:"#f1f5f9"}}>{item.model}</div><div style={{fontSize:9,color:"#4b5563"}}>{item.sku}</div></div><span style={S.badge(item.condition==="new"?"#4ade80":"#fbbf24")}>{item.condition==="new"?"New":"Refurb"}</span><span style={{fontSize:10,color:avail<0?"#f87171":"#4ade80",fontWeight:600,minWidth:50,textAlign:"right"}}>{avail<0?"SHORT":avail+" avail"}</span><button style={{...S.btn("#374151"),padding:"4px 9px",fontSize:11}} onClick={()=>onChange({...inv,[item.id]:{required:1,reserved:0,staged:0,delivered:0}})}>+ Add</button></div>;})}</div>
  </div>;
}

// ── Project Modal ─────────────────────────────────────────────────────────────
function ProjectModal({project,customer,catalog,staff,onClose,onSave,onDel}){
  const [f,setF]=useState({...project,tasks:project.tasks||defaultTasks(),inventory:project.inventory||{},billing:project.billing||{},goLiveChecklist:project.goLiveChecklist||defaultGoLive(),supportHandoff:project.supportHandoff||{},contactLog:project.contactLog||[],documents:project.documents||[]});
  const [tab,setTab]=useState("details");
  const u=(k,v)=>setF(p=>({...p,[k]:v}));
  const toggleSvc=sv=>setF(p=>({...p,services:p.services.includes(sv)?p.services.filter(x=>x!==sv):[...p.services,sv]}));
  const {score,flags}=calcRisk(f);const rc=riskColor(score);const gates=getGates(f);const ca=gates.every(g=>g.met);const ns=NEXT_STAGE[f.stage];
  const taskDefs=Object.entries(defaultTasks()).map(([id,t])=>({id,...t}));const tasksDone=taskDefs.filter(d=>f.tasks?.[d.id]?.done).length;
  const mrr=calcMRR(f.services,f.lines);const billing=f.billing||{};const total=(billing.equipInvoiceAmount||0)+(billing.installInvoiceAmount||0);
  const TABS=["details","gates","tasks","inventory","billing","go-live","handoff","contact-log","documents"];
  const TL={"details":"📋 Details","gates":"🔒 Gates","tasks":"✅ Tasks ("+tasksDone+"/"+taskDefs.length+")","inventory":"📦 Inventory","billing":"💰 Billing","go-live":"🚀 Go-Live","handoff":"🤝 Handoff","contact-log":"📞 Log","documents":"📎 Docs ("+f.documents.length+")"};
  return <Modal width={720} onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
        <div><div style={{fontWeight:800,fontSize:15,color:"#f1f5f9"}}>{customer?.company||"—"} · {f.name||"New Project"}</div><div style={{fontSize:11,color:"#4b5563",marginTop:2}}>{f.zohoLinked&&<span style={{...S.badge("#38bdf8"),marginRight:6}}>🔗{f.zohoDealId}</span>}{mrr>0&&<span style={S.badge("#4ade80")}>MRR {f$(mrr)}/mo</span>}</div></div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}><RiskBadge score={score}/><button style={S.outBtn} onClick={onClose}>✕</button></div>
      </div>
      {score>=50&&<div style={S.alert(rc)}>🔴 High Risk ({score}) — {flags.join(", ")}</div>}
      <div style={{display:"flex",borderBottom:"1px solid #1e2d45",marginBottom:14,overflowX:"auto"}}>{TABS.map(t=><button key={t} style={{...tabStyle(tab===t),padding:"8px 7px",fontSize:10}} onClick={()=>setTab(t)}>{TL[t]}</button>)}</div>

      {tab==="details"&&<div>
        <div style={{...S.grid2,marginBottom:12}}>
          <div><label style={S.lbl}>Project Name</label><input style={S.inp} value={f.name||""} onChange={e=>u("name",e.target.value)}/></div>
          <div><label style={S.lbl}>Stage</label><select style={S.sel} value={f.stage} onChange={e=>u("stage",e.target.value)}>{ALL_STAGES.map(st=><option key={st}>{st}</option>)}</select></div>
          <div><label style={S.lbl}>Zoho Deal ID</label><input style={S.inp} value={f.zohoDealId||""} onChange={e=>u("zohoDealId",e.target.value)}/></div>
          <div><label style={S.lbl}>Lines</label><input style={S.inp} type="number" value={f.lines||1} onChange={e=>u("lines",+e.target.value)}/></div>
          <div><label style={S.lbl}>Install Date</label><input style={S.inp} type="date" value={f.installDate||""} onChange={e=>u("installDate",e.target.value)}/></div>
          <div><label style={S.lbl}>Port Date</label><input style={S.inp} type="date" value={f.portDate||""} onChange={e=>u("portDate",e.target.value)}/></div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={S.sechdr}>👤 Assigned Staff</div>
          <div style={S.grid2}>
            <StaffSelect value={f.assignedCA} onChange={v=>u("assignedCA",v)} staff={staff} roleFilter="Contract Admin" label="Contract Admin"/>
            <StaffSelect value={f.assignedPM} onChange={v=>u("assignedPM",v)} staff={staff} roleFilter="Project Manager" label="Project Manager"/>
            <StaffSelect value={f.assignedInstaller} onChange={v=>u("assignedInstaller",v)} staff={staff} roleFilter="Installer" label="Installer"/>
            <StaffSelect value={f.assignedAccounting} onChange={v=>u("assignedAccounting",v)} staff={staff} roleFilter="Accounting" label="Accounting"/>
          </div>
        </div>
        <div style={{marginBottom:12}}>
          <div style={S.sechdr}>Services *</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:7}}>{SERVICES.map(sv=>{const on=f.services.includes(sv);const c=SVC_COLOR[sv];return <button key={sv} onClick={()=>toggleSvc(sv)} style={{padding:"5px 11px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:"2px solid "+(on?c:"#1e2d45"),background:on?c+"22":"transparent",color:on?c:"#4b5563"}}>{on?"✓ ":""}{sv}</button>;})}</div>
          {mrr>0&&<div style={{marginTop:6,fontSize:11,color:"#4ade80"}}>Estimated MRR: {f$(mrr)}/month</div>}
        </div>
        <div style={{marginBottom:12}}>
          <div style={S.sechdr}>Site Survey</div>
          <div style={S.grid2}>
            <div style={{display:"flex",gap:8,alignItems:"center",paddingTop:16}}><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.siteSurvey?.required} onChange={e=>u("siteSurvey",{...f.siteSurvey,required:e.target.checked})}/>Survey Required</label></div>
            <div><label style={S.lbl}>Status</label><select style={S.sel} value={f.siteSurvey?.status||"Not Needed"} onChange={e=>u("siteSurvey",{...f.siteSurvey,status:e.target.value})}>{["Not Needed","Required","Scheduled","Completed","Blocked"].map(v=><option key={v}>{v}</option>)}</select></div>
            <div><label style={S.lbl}>Survey Date</label><input style={S.inp} type="date" value={f.siteSurvey?.date||""} onChange={e=>u("siteSurvey",{...f.siteSurvey,date:e.target.value})}/></div>
            <div><label style={S.lbl}>Assigned Tech</label><input style={S.inp} value={f.siteSurvey?.tech||""} onChange={e=>u("siteSurvey",{...f.siteSurvey,tech:e.target.value})}/></div>
          </div>
          <div style={{display:"flex",gap:14,marginTop:8,flexWrap:"wrap"}}>
            <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.siteSurvey?.reportAttached} onChange={e=>u("siteSurvey",{...f.siteSurvey,reportAttached:e.target.checked})}/>Report Attached</label>
            <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.accScopeLocked} onChange={e=>u("accScopeLocked",e.target.checked)}/>Scope Locked</label>
            <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.installerCheckedIn} onChange={e=>u("installerCheckedIn",e.target.checked)}/>Installer Checked In</label>
            <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.riskBlocked} onChange={e=>u("riskBlocked",e.target.checked)}/>Mark Blocked</label>
            <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.archived} onChange={e=>u("archived",e.target.checked)}/>Archive</label>
          </div>
        </div>
        <div><label style={S.lbl}>Notes</label><textarea style={{...S.inp,height:50,resize:"vertical"}} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></div>
      </div>}
      {tab==="gates"&&<div style={{background:"#0d1628",border:"1px solid #1e2d45",borderRadius:8,padding:"12px 14px"}}><div style={{fontSize:10,fontWeight:700,color:"#4b5563",textTransform:"uppercase",marginBottom:10}}>{f.stage} → {ns||"(end)"} &nbsp;{ca?<span style={{color:"#4ade80"}}>✓ ALL CLEAR</span>:<span style={{color:"#f87171"}}>🔒 BLOCKED</span>}</div>{gates.map((g,i)=><div key={i} style={{display:"flex",gap:8,alignItems:"center",marginBottom:6,fontSize:12}}><span style={{color:g.met?"#4ade80":"#f87171",fontWeight:700,width:16}}>{g.met?"✓":"✗"}</span><span style={{color:g.met?"#6b7280":"#f1f5f9"}}>{g.l}</span>{!g.met&&<span style={{...S.badge("#f87171"),fontSize:9}}>REQUIRED</span>}</div>)}{gates.length===0&&<div style={{color:"#4b5563",fontSize:12}}>No requirements.</div>}</div>}
      {tab==="tasks"&&<TasksPanel o={f} onChange={v=>u("tasks",v)}/>}
      {tab==="inventory"&&<ProjectInventoryPicker inv={f.inventory||{}} catalog={catalog.filter(i=>i.active)} onChange={v=>u("inventory",v)}/>}
      {tab==="billing"&&<div>
        <div style={S.sechdr}>💰 Billing</div>
        {total>0&&<div style={{background:"#0d1628",borderRadius:6,padding:"8px 12px",marginBottom:10,fontSize:12,display:"flex",gap:16,flexWrap:"wrap"}}><span>Total: <strong style={{color:"#fbbf24"}}>{f$(total)}</strong></span><span>GM: <strong style={{color:calcMargin(f).gm>=40?"#4ade80":"#f87171"}}>{calcMargin(f).label}</strong></span>{mrr>0&&<span>MRR: <strong style={{color:"#4ade80"}}>{f$(mrr)}/mo</strong></span>}</div>}
        <div style={S.alert("#fbbf24")}>⚠️ Pipeline estimate only — MRR and margin figures are app estimates for pipeline visibility. Do not use for revenue forecasting or financial reporting.</div>
        <div style={S.grid2}>
          <div><label style={S.lbl}>Equipment Invoice ($)</label><input style={S.inp} type="number" value={billing.equipInvoiceAmount||0} onChange={e=>u("billing",{...billing,equipInvoiceAmount:+e.target.value})}/></div>
          <div><label style={S.lbl}>Install Invoice ($)</label><input style={S.inp} type="number" value={billing.installInvoiceAmount||0} onChange={e=>u("billing",{...billing,installInvoiceAmount:+e.target.value})}/></div>
          <div><label style={S.lbl}>Equip Invoice Date</label><input style={S.inp} type="date" value={billing.equipInvoiceDate||""} onChange={e=>u("billing",{...billing,equipInvoiceDate:e.target.value})}/></div>
          <div><label style={S.lbl}>Equip Payment Date</label><input style={S.inp} type="date" value={billing.equipPaymentDate||""} onChange={e=>u("billing",{...billing,equipPaymentDate:e.target.value})}/></div>
          <div><label style={S.lbl}>Payment Method</label><select style={S.sel} value={billing.equipPaymentMethod||""} onChange={e=>u("billing",{...billing,equipPaymentMethod:e.target.value})}>{["","ACH","Check","Wire","Credit Card"].map(v=><option key={v}>{v}</option>)}</select></div>
          <div><label style={S.lbl}>Install Invoice Date</label><input style={S.inp} type="date" value={billing.installInvoiceDate||""} onChange={e=>u("billing",{...billing,installInvoiceDate:e.target.value})}/></div>
          <div><label style={S.lbl}>Install Payment Date</label><input style={S.inp} type="date" value={billing.installPaymentDate||""} onChange={e=>u("billing",{...billing,installPaymentDate:e.target.value})}/></div>
        </div>
        <div style={{display:"flex",gap:16,marginTop:10}}><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!billing.invoiced} onChange={e=>u("billing",{...billing,invoiced:e.target.checked})}/>Invoiced</label><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!billing.paid} onChange={e=>u("billing",{...billing,paid:e.target.checked})}/>Paid</label></div>
      </div>}
      {tab==="go-live"&&<GoLiveChecklist checklist={f.goLiveChecklist||defaultGoLive()} onChange={v=>u("goLiveChecklist",v)}/>}
      {tab==="handoff"&&<SupportHandoff handoff={f.supportHandoff||{}} onChange={v=>u("supportHandoff",v)}/>}
      {tab==="contact-log"&&<ContactLog p={f} onChange={v=>u("contactLog",v)}/>}
      {tab==="documents"&&<DocumentManager docs={f.documents||[]} onChange={v=>u("documents",v)}/>}

      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,borderTop:"1px solid #1e2d45",marginTop:8,flexWrap:"wrap",gap:8}}>
        <div style={{display:"flex",gap:8}}>{project.id&&<button style={S.btn("#ef4444")} onClick={()=>onDel(project.id)}>Delete</button>}{ns&&<button title={!ca?"Gates not met":undefined} style={{...S.btn(ca?"#4ade80":"#374151",ca?"#000":"#6b7280"),cursor:ca?"pointer":"not-allowed"}} onClick={()=>{if(ca)onSave({...f,stage:ns,stageEnteredDate:todayStr});}}>{ ca?"✓":"🔒"} → {ns}</button>}</div>
        <div style={{display:"flex",gap:8}}><button style={S.outBtn} onClick={onClose}>Cancel</button><button style={S.btn()} onClick={()=>onSave(f)}>Save</button></div>
      </div>
  </Modal>;
}

// ── Customer Modal ────────────────────────────────────────────────────────────
function CustomerModal({customer,staff,onClose,onSave,onDel}){
  const [f,setF]=useState({...customer});const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal width={560} onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{fontWeight:800,fontSize:15,color:"#f1f5f9"}}>{customer.id?"Edit Customer":"New Customer"}</span><button style={S.outBtn} onClick={onClose}>✕</button></div>
      <div style={S.grid2}>
        <div><label style={S.lbl}>Company *</label><input style={S.inp} value={f.company||""} onChange={e=>u("company",e.target.value)}/></div>
        <div><label style={S.lbl}>Contact</label><input style={S.inp} value={f.contact||""} onChange={e=>u("contact",e.target.value)}/></div>
        <div><label style={S.lbl}>Phone</label><input style={S.inp} value={f.phone||""} onChange={e=>u("phone",e.target.value)}/></div>
        <div><label style={S.lbl}>Email</label><input style={S.inp} value={f.email||""} onChange={e=>u("email",e.target.value)}/></div>
        <div><label style={S.lbl}>Sales Rep</label><StaffSelect value={f.rep} onChange={v=>u("rep",v)} staff={staff} roleFilter="Sales" placeholder="— Select Rep —"/></div>
        <div><label style={S.lbl}>Zoho Account ID</label><input style={S.inp} value={f.zohoAccountId||""} onChange={e=>u("zohoAccountId",e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Address</label><input style={S.inp} value={f.address||""} onChange={e=>u("address",e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes</label><textarea style={{...S.inp,height:50,resize:"vertical"}} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:14,flexWrap:"wrap",gap:8}}>
        {customer.id&&<button style={S.btn("#ef4444")} onClick={()=>onDel(customer.id)}>Delete</button>}
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}><button style={S.outBtn} onClick={onClose}>Cancel</button><button style={S.btn()} onClick={()=>{if(f.company.trim())onSave(f);}}>Save</button></div>
      </div>
  </Modal>;
}

// ── STAFF MODAL ───────────────────────────────────────────────────────────────
function StaffModal({member,onClose,onSave,onDel}){
  const [f,setF]=useState({...member});const u=(k,v)=>setF(p=>({...p,[k]:v}));
  function toggleRole(r){setF(p=>({...p,roles:p.roles.includes(r)?p.roles.filter(x=>x!==r):[...p.roles,r]}));}
  return <Modal zIndex={1050} width={520} onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{fontWeight:800,fontSize:15,color:"#f1f5f9"}}>{member.id&&member.name?`Edit: ${member.name}`:"New Staff Member"}</span><button style={S.outBtn} onClick={onClose}>✕</button></div>
      <div style={S.grid2}>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Full Name *</label><input style={S.inp} value={f.name||""} onChange={e=>u("name",e.target.value)}/></div>
        <div><label style={S.lbl}>Email</label><input style={S.inp} value={f.email||""} onChange={e=>u("email",e.target.value)}/></div>
        <div><label style={S.lbl}>Phone</label><input style={S.inp} value={f.phone||""} onChange={e=>u("phone",e.target.value)}/></div>
      </div>
      <div style={{marginTop:12}}>
        <div style={S.sechdr}>Roles (select all that apply)</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
          {STAFF_ROLES.map(r=>{const on=f.roles.includes(r);const c=ROLE_COLOR[r];return <button key={r} onClick={()=>toggleRole(r)} style={{padding:"6px 13px",borderRadius:6,fontSize:12,fontWeight:600,cursor:"pointer",border:"2px solid "+(on?c:"#1e2d45"),background:on?c+"22":"transparent",color:on?c:"#4b5563"}}>{ROLE_ICON[r]} {r}</button>;})}
        </div>
      </div>
      <div><label style={S.lbl}>Notes</label><input style={S.inp} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></div>
      <div style={{display:"flex",gap:8,marginTop:10,alignItems:"center"}}>
        <label style={{fontSize:12,display:"flex",gap:6,alignItems:"center",cursor:"pointer"}}><input type="checkbox" checked={!!f.active} onChange={e=>u("active",e.target.checked)}/>Active</label>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:14,flexWrap:"wrap",gap:8}}>
        {member.id&&<button style={S.btn("#ef4444")} onClick={()=>onDel(member.id)}>Remove</button>}
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}><button style={S.outBtn} onClick={onClose}>Cancel</button><button style={S.btn()} onClick={()=>{if(f.name.trim())onSave(f);}}>Save</button></div>
      </div>
  </Modal>;
}

// ── STAFF VIEW ────────────────────────────────────────────────────────────────
function StaffView({staff,projects,onEdit,onNew}){
  const [roleFilter,setRoleFilter]=useState("All");
  const [showInactive,setShowInactive]=useState(false);
  const visible=staff.filter(s=>(showInactive||s.active)&&(roleFilter==="All"||s.roles.includes(roleFilter)));
  return <div>
    <div style={{...S.flexWrap,marginBottom:14,alignItems:"center"}}>
      {STAFF_ROLES.map(r=>{const n=staff.filter(s=>s.active&&s.roles.includes(r)).length;const c=ROLE_COLOR[r];return <div key={r} style={{background:c+"15",border:"1px solid "+c+"30",borderRadius:8,padding:"8px 13px",minWidth:100,flex:"1 1 100px",cursor:"pointer"}} onClick={()=>setRoleFilter(roleFilter===r?"All":r)}><div style={{fontSize:18,fontWeight:800,color:"#f1f5f9"}}>{n}</div><div style={{fontSize:11,color:c,fontWeight:600}}>{ROLE_ICON[r]} {r}</div></div>;})}
    </div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
      <div style={{display:"flex",gap:6,flexWrap:"wrap",flex:1}}>{["All",...STAFF_ROLES].map(r=><button key={r} onClick={()=>setRoleFilter(r)} style={{...S.outBtn,background:roleFilter===r?"#1e3a5f":"transparent",color:roleFilter===r?"#38bdf8":"#4b5563",borderColor:roleFilter===r?"#38bdf8":"#1e2d45",fontSize:11,padding:"5px 10px"}}>{r}</button>)}</div>
      <label style={{fontSize:12,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Show inactive</label>
      <button style={S.btn()} onClick={onNew}>+ Add Staff</button>
    </div>
    <div style={S.card}>
      <div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>Team Members ({visible.length})</span></div>
      <table style={S.tbl}>
        <thead><tr>{["Name","Roles","Email","Phone","Active Projects","Status","Edit"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
        <tbody>{visible.map(s=>{
          const assigned=projects.filter(p=>!p.archived&&!["Closed","Handed to Support"].includes(p.stage)&&(p.assignedCA===s.name||p.assignedPM===s.name||p.assignedInstaller===s.name||p.assignedAccounting===s.name));
          return <tr key={s.id} style={{cursor:"pointer"}} onClick={()=>onEdit(s)}>
            <td style={S.td}><strong style={{color:"#f1f5f9"}}>{s.name}</strong>{s.notes&&<div style={{fontSize:10,color:"#4b5563"}}>{s.notes}</div>}</td>
            <td style={S.td}>{s.roles.map(r=><span key={r} style={{...S.badge(ROLE_COLOR[r]||"#64748b"),marginRight:3,marginBottom:2,fontSize:9}}>{ROLE_ICON[r]} {r}</span>)}</td>
            <td style={{...S.td,fontSize:11,color:"#94a3b8"}}>{s.email||"—"}</td>
            <td style={{...S.td,fontSize:11,color:"#94a3b8"}}>{s.phone||"—"}</td>
            <td style={S.td}><span style={{fontWeight:700,color:assigned.length>0?"#38bdf8":"#4b5563"}}>{assigned.length}</span></td>
            <td style={S.td}>{s.active?<span style={S.badge("#4ade80")}>Active</span>:<span style={S.badge("#4b5563")}>Inactive</span>}</td>
            <td style={S.td} onClick={e=>e.stopPropagation()}><button style={S.btn("#374151")} onClick={()=>onEdit(s)}>Edit</button></td>
          </tr>;
        })}</tbody>
      </table>
    </div>
  </div>;
}

// ── KANBAN COLUMN ─────────────────────────────────────────────────────────────
function KanbanBoard({stages,projects,customers,onOpen,onAdvance,accentField}){
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  return <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:12,alignItems:"flex-start"}}>
    {stages.map(stage=>{
      const cards=projects.filter(p=>p.stage===stage);
      const hc=SC[stage]||"#64748b";
      return <div key={stage} style={{background:"#111827",borderRadius:8,padding:9,width:175,minWidth:175,flexShrink:0,border:"1px solid #1e2d45",minHeight:60}}>
        <div style={{fontSize:9,fontWeight:800,color:hc,marginBottom:7,textTransform:"uppercase",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{stage}</span>
          <span style={{background:hc+"25",borderRadius:4,padding:"0 5px",flexShrink:0,marginLeft:4}}>{cards.length}</span>
        </div>
        {cards.map(p=>{
          const {score}=calcRisk(p);const rc=riskColor(score);const ca=canAdvance(p);const ns=NEXT_STAGE[stage];const cust=getCust(p);
          return <div key={p.id} onClick={()=>onOpen(p)} style={{background:"#0d1628",borderRadius:6,padding:8,marginBottom:5,border:"1px solid #1e2d45",cursor:"pointer",borderLeft:"3px solid "+rc}}>
            <div style={{fontWeight:700,color:"#f1f5f9",fontSize:11,marginBottom:1}}>{cust?.company}</div>
            <div style={{fontSize:10,color:"#4b5563",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
            {p[accentField]&&<div style={{fontSize:9,color:"#38bdf8",marginTop:2}}>👤 {p[accentField]}</div>}
            <div style={{display:"flex",gap:4,marginTop:4,flexWrap:"wrap"}}><RiskBadge score={score}/><AgingPill p={p}/></div>
            {p.installDate&&<div style={{fontSize:9,color:"#fb923c",marginTop:3}}>📅 {p.installDate}</div>}
            {ns&&<button onClick={e=>{e.stopPropagation();if(ca)onAdvance(p);}} disabled={!ca} style={{...S.btn(ca?SC[ns]||"#4ade80":"#1e2d45",ca?"#000":"#4b5563"),width:"100%",marginTop:5,fontSize:9,padding:"3px 5px",cursor:ca?"pointer":"not-allowed"}}>{ca?"→ "+ns.split(" ")[0]+"…":"🔒 Gated"}</button>}
          </div>;
        })}
        {cards.length===0&&<div style={{fontSize:10,color:"#1e2d45",textAlign:"center",padding:"8px 0"}}>empty</div>}
      </div>;
    })}
  </div>;
}

// ── TODAY ─────────────────────────────────────────────────────────────────────
function TodayView({projects,customers,pool,onOpenProject}){
  const active=projects.filter(p=>!p.archived);
  const sorted=useMemo(()=>[...active].sort((a,b)=>calcRisk(b).score-calcRisk(a).score),[active]);
  const critical=sorted.filter(p=>calcRisk(p).score>=50);
  const atRisk=sorted.filter(p=>{const s=calcRisk(p).score;return s>=25&&s<50;});
  const installSoon=active.filter(p=>p.installDate&&daysUntil(p.installDate)<=7&&!["Closed","Handed to Support"].includes(p.stage));
  const unpaidOld=active.filter(p=>p.billing?.invoiced&&!p.billing?.paid&&daysSince(p.billing?.equipInvoiceDate)>7);
  const totalUnpaid=unpaidOld.reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0);
  const invAlerts=pool.filter(p=>(p.totalQty-p.reserved)<=p.low);
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const totalMRR=active.filter(p=>!["Closed","Handed to Support"].includes(p.stage)).reduce((a,p)=>a+calcMRR(p.services,p.lines),0);
  function RiskRow({proj}){const {score,flags}=calcRisk(proj);const c=riskColor(score);const cust=getCust(proj);return <div onClick={()=>onOpenProject(proj)} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#0d1628",borderRadius:7,marginBottom:5,cursor:"pointer",border:"1px solid #1e2d45",borderLeft:"3px solid "+c,flexWrap:"wrap"}}><div style={{minWidth:150}}><div style={{fontWeight:700,color:"#f1f5f9",fontSize:12}}>{cust?.company}</div><div style={{fontSize:10,color:"#4b5563"}}>{proj.name}</div></div><StageBadge stage={proj.stage}/><RiskBadge score={score}/><span style={{fontSize:11,color:"#4b5563",flex:1}}>{flags.map(f=>({aging:"⏱ Aging",blocked:"🚫 Blocked",unpaid:"💸 Unpaid",inv_short:"📦 Stock",ship_risk:"🚚 Ship"})[f]||f).join(" · ")}</span>{proj.installDate&&<span style={{fontSize:10,color:"#fb923c"}}>📅 {proj.installDate}</span>}</div>;}
  return <div>
    <div style={{...S.flexWrap,marginBottom:14}}>
      <StatCard l="Critical" v={critical.length} c="#f87171"/>
      <StatCard l="At Risk" v={atRisk.length} c="#fbbf24"/>
      <StatCard l="Installs ≤7d" v={installSoon.length} c="#fb923c"/>
      <StatCard l="Unpaid >7d" v={f$(totalUnpaid)} c="#f87171"/>
      <StatCard l="Total MRR" v={f$(totalMRR)} c="#4ade80"/>
    </div>
    {critical.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f87171"}}>🔴 Critical</span></div><div style={{padding:"10px 14px"}}>{critical.map(p=><RiskRow key={p.id} proj={p}/>)}</div></div>}
    {atRisk.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#fbbf24"}}>🟡 At Risk</span></div><div style={{padding:"10px 14px"}}>{atRisk.map(p=><RiskRow key={p.id} proj={p}/>)}</div></div>}
    {invAlerts.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#fb923c"}}>📦 Inventory Alerts</span></div><div style={{padding:"10px 14px"}}>{invAlerts.map(p=><div key={p.id} style={S.alert("#fb923c")}><strong>{p.label||p.model}</strong> — {p.totalQty-p.reserved} available</div>)}</div></div>}
    {unpaidOld.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#4ade80"}}>💰 Revenue at Risk</span></div><div style={{padding:"10px 14px"}}><div style={S.alert("#f87171")}>{f$(totalUnpaid)} invoiced, unpaid &gt;7d — {unpaidOld.map(p=>getCust(p)?.company||"?").join(", ")}</div></div></div>}
    {critical.length===0&&atRisk.length===0&&invAlerts.length===0&&unpaidOld.length===0&&<div style={{background:"#111827",borderRadius:10,border:"1px solid #1e2d45",padding:40,textAlign:"center",color:"#4b5563"}}>✅ All clear — no critical items today.</div>}
  </div>;
}

// ── CUSTOMERS VIEW ────────────────────────────────────────────────────────────
function CustomersView({customers,projects,staff,onEditCustomer,onNewCustomer,onSelectCustomer}){
  const [search,setSearch]=useState("");
  const filtered=useMemo(()=>customers.filter(c=>{const q=search.toLowerCase();return !q||c.company.toLowerCase().includes(q)||c.contact.toLowerCase().includes(q)||(c.rep||"").toLowerCase().includes(q)||(c.zohoAccountId||"").toLowerCase().includes(q);}),[customers,search]);
  const totalMRR=customers.reduce((a,c)=>{return a+projects.filter(p=>p.customerId===c.id&&!p.archived).reduce((b,p)=>b+calcMRR(p.services,p.lines),0);},0);
  return <div>
    <div style={{...S.flexWrap,marginBottom:14}}><StatCard l="Total Customers" v={customers.length} c="#38bdf8"/><StatCard l="Total MRR" v={f$(totalMRR)} c="#4ade80"/><StatCard l="Zoho Linked" v={customers.filter(c=>c.zohoAccountId).length} c="#a78bfa"/></div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap"}}>
      <div style={{flex:"2 1 200px"}}><label style={S.lbl}>Search</label><input style={{...S.inp,fontSize:12}} placeholder="Company, contact, rep, Zoho ID…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <button style={S.btn()} onClick={onNewCustomer}>+ New Customer</button>
      <button style={S.outBtn} onClick={()=>exportCSV(filtered.map(c=>({Company:c.company,Contact:c.contact,Phone:c.phone,Email:c.email,Rep:c.rep,ZohoAccountId:c.zohoAccountId,Notes:c.notes,Created:c.createdDate})),"customers_export")}>⬇ Export</button>
    </div>
    <div style={S.card}><table style={S.tbl}><thead><tr>{["Company","Contact","Rep","Zoho","Projects","MRR","Actions"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{filtered.map(c=>{const cProjects=projects.filter(p=>p.customerId===c.id);const active=cProjects.filter(p=>!["Closed","Handed to Support"].includes(p.stage)&&!p.archived);const mrr=cProjects.filter(p=>!p.archived).reduce((a,p)=>a+calcMRR(p.services,p.lines),0);return <tr key={c.id} style={{cursor:"pointer"}} onClick={()=>onSelectCustomer(c)}><td style={S.td}><strong style={{color:"#f1f5f9"}}>{c.company}</strong>{c.zohoAccountId&&<span style={{...S.badge("#38bdf8"),marginLeft:6,fontSize:9}}>🔗{c.zohoAccountId}</span>}</td><td style={S.td}><div style={{fontSize:12,color:"#f1f5f9"}}>{c.contact}</div><div style={{fontSize:10,color:"#4b5563"}}>{c.phone}</div></td><td style={S.td}>{c.rep||"—"}</td><td style={S.td}>{c.zohoAccountId?<span style={S.badge("#38bdf8")}>{c.zohoAccountId}</span>:"—"}</td><td style={S.td}><span style={{fontWeight:700,color:"#f1f5f9"}}>{cProjects.length}</span><span style={{fontSize:10,color:"#4b5563"}}> ({active.length} active)</span></td><td style={{...S.td,color:"#4ade80",fontWeight:600}}>{mrr?f$(mrr)+"/mo":"—"}</td><td style={S.td} onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:5}}><button style={S.btn("#374151")} onClick={()=>onEditCustomer(c)}>Edit</button><button style={S.btn("#38bdf8","#000")} onClick={()=>onSelectCustomer(c)}>Projects →</button></div></td></tr>;})} </tbody></table></div>
  </div>;
}

// ── CUSTOMER DETAIL ───────────────────────────────────────────────────────────
function CustomerDetail({customer,projects,onBack,onNewProject,onOpenProject,onNewProjectFromZoho}){
  const cProjects=projects.filter(p=>p.customerId===customer.id);
  const active=cProjects.filter(p=>!p.archived);const archived=cProjects.filter(p=>p.archived);
  const [showArchived,setShowArchived]=useState(false);
  const totalMRR=cProjects.filter(p=>!p.archived).reduce((a,p)=>a+calcMRR(p.services,p.lines),0);
  const totalRev=cProjects.reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0);
  function PCard({proj}){const {score}=calcRisk(proj);const c=riskColor(score);const pct=stageProgress(proj.stage);return <div onClick={()=>onOpenProject(proj)} style={{background:"#0d1628",borderRadius:8,padding:12,marginBottom:8,cursor:"pointer",border:"1px solid #1e2d45",borderLeft:"3px solid "+c}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:6}}><div><div style={{fontWeight:700,color:"#f1f5f9",fontSize:13}}>{proj.name}</div><div style={{fontSize:10,color:"#4b5563",marginTop:2}}>{proj.lines} lines{proj.installDate?" · Install: "+proj.installDate:""}{proj.zohoLinked&&<span style={{...S.badge("#38bdf8"),marginLeft:6,fontSize:9}}>🔗</span>}</div></div><div style={{display:"flex",gap:6,flexWrap:"wrap"}}>{(proj.services||[]).map(sv=><SvcBadge key={sv} sv={sv}/>)}<StageBadge stage={proj.stage}/><RiskBadge score={score}/></div></div><div style={{marginTop:8}}><ProgressBar pct={pct} stage={proj.stage}/></div></div>;}
  return <div>
    <button style={S.outBtn} onClick={onBack}>← Back to Customers</button>
    <div style={{background:"#111827",borderRadius:10,border:"1px solid #1e2d45",padding:"16px 20px",margin:"14px 0"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",flexWrap:"wrap",gap:10}}>
        <div><div style={{fontWeight:800,fontSize:18,color:"#f1f5f9"}}>{customer.company}</div><div style={{fontSize:12,color:"#94a3b8",marginTop:3}}>{customer.contact} · {customer.phone}</div>{customer.zohoAccountId&&<div style={{marginTop:5}}><span style={S.badge("#38bdf8")}>🔗 Zoho: {customer.zohoAccountId}</span></div>}</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}><StatCard l="MRR" v={f$(totalMRR)+"/mo"} c="#4ade80"/><StatCard l="Total Rev" v={f$(totalRev)} c="#fbbf24"/><StatCard l="Projects" v={cProjects.length} c="#38bdf8"/></div>
      </div>
    </div>
    <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
      <button style={S.btn()} onClick={onNewProject}>+ New Project (Manual)</button>
      <button style={S.btn("#38bdf8","#000")} onClick={onNewProjectFromZoho}>🔗 Import from Zoho</button>
    </div>
    {active.length>0&&<div><div style={{...S.sechdr,marginBottom:10}}>Active Projects ({active.length})</div>{active.map(p=><PCard key={p.id} proj={p}/>)}</div>}
    {archived.length>0&&<div><button style={{...S.outBtn,marginBottom:8}} onClick={()=>setShowArchived(a=>!a)}>{showArchived?"▲":"▼"} Archived ({archived.length})</button>{showArchived&&archived.map(p=><div key={p.id} style={{opacity:.6}}><PCard proj={p}/></div>)}</div>}
    {cProjects.length===0&&<div style={{background:"#111827",borderRadius:10,border:"1px solid #1e2d45",padding:40,textAlign:"center",color:"#4b5563"}}>No projects yet.</div>}
  </div>;
}

// ── PROJECTS VIEW ─────────────────────────────────────────────────────────────
function ProjectsView({projects,customers,onOpenProject,onNewProject}){
  const [search,setSearch]=useState("");const [fStage,setFStage]=useState("All");const [fRep,setFRep]=useState("All");const [showArchived,setShowArchived]=useState(false);const [sortK,setSortK]=useState("risk");const [sortD,setSortD]=useState("desc");
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const reps=useMemo(()=>["All",...[...new Set(customers.map(c=>c.rep).filter(Boolean))].sort()],[customers]);
  function toggleSort(k){if(sortK===k)setSortD(d=>d==="asc"?"desc":"asc");else{setSortK(k);setSortD("desc");}}
  function arr(k){return sortK!==k?" ↕":sortD==="asc"?" ↑":" ↓";}
  const filtered=useMemo(()=>{const q=search.toLowerCase();return [...projects].filter(p=>{if(!showArchived&&p.archived)return false;const cust=getCust(p);if(q&&!(cust?.company||"").toLowerCase().includes(q)&&!p.name.toLowerCase().includes(q)&&!(p.zohoDealId||"").toLowerCase().includes(q))return false;if(fStage!=="All"){const g={CA:STAGES_CA,PM:STAGES_PM,Installer:STAGES_INS,Accounting:STAGES_ACC}[fStage];if(g&&!g.includes(p.stage))return false;}if(fRep!=="All"&&getCust(p)?.rep!==fRep)return false;return true;}).sort((a,b)=>{let av,bv;if(sortK==="risk"){av=calcRisk(a).score;bv=calcRisk(b).score;}else if(sortK==="company"){av=(getCust(a)?.company||"").toLowerCase();bv=(getCust(b)?.company||"").toLowerCase();}else if(sortK==="stage"){av=ALL_STAGES.indexOf(a.stage);bv=ALL_STAGES.indexOf(b.stage);}else if(sortK==="value"){av=(a.billing?.equipInvoiceAmount||0)+(a.billing?.installInvoiceAmount||0);bv=(b.billing?.equipInvoiceAmount||0)+(b.billing?.installInvoiceAmount||0);}else{av=0;bv=0;}return sortD==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);});},[projects,search,fStage,fRep,showArchived,sortK,sortD]);
  const ss={...S.sel,padding:"6px 9px",fontSize:11};
  return <div>
    <div style={{...S.flexWrap,marginBottom:14}}><StatCard l="Shown" v={filtered.length} c="#38bdf8"/><StatCard l="Pipeline" v={f$(filtered.filter(p=>!p.archived).reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0))} c="#fbbf24"/><StatCard l="MRR" v={f$(filtered.filter(p=>!p.archived).reduce((a,p)=>a+calcMRR(p.services,p.lines),0))+"/mo"} c="#4ade80"/><StatCard l="Critical" v={filtered.filter(p=>calcRisk(p).score>=50).length} c="#f87171"/></div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div style={{flex:"2 1 160px"}}><label style={S.lbl}>Search</label><input style={{...S.inp,fontSize:12}} placeholder="Company, project, Zoho ID…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
      <div style={{flex:"1 1 100px"}}><label style={S.lbl}>Phase</label><select style={ss} value={fStage} onChange={e=>setFStage(e.target.value)}>{["All","CA","PM","Installer","Accounting"].map(v=><option key={v}>{v}</option>)}</select></div>
      <div style={{flex:"1 1 90px"}}><label style={S.lbl}>Rep</label><select style={ss} value={fRep} onChange={e=>setFRep(e.target.value)}>{reps.map(r=><option key={r}>{r}</option>)}</select></div>
      <label style={{fontSize:12,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={showArchived} onChange={e=>setShowArchived(e.target.checked)}/>Archived</label>
      <button style={S.outBtn} onClick={()=>exportCSV(filtered.map(p=>{const c=getCust(p);return{Customer:c?.company,Rep:c?.rep,Project:p.name,Stage:p.stage,ZohoDealId:p.zohoDealId,Lines:p.lines,EquipAmt:p.billing?.equipInvoiceAmount||0,InstallAmt:p.billing?.installInvoiceAmount||0,MRR:calcMRR(p.services,p.lines),InstallDate:p.installDate,Risk:calcRisk(p).score,CA:p.assignedCA,PM:p.assignedPM,Installer:p.assignedInstaller,Accounting:p.assignedAccounting,Archived:p.archived?"Yes":"No"}}),"projects_export")}>⬇ Export</button>
      <button style={S.btn()} onClick={onNewProject}>+ New Project</button>
    </div>
    <div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>All Projects — {filtered.length}</span></div>
    <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{[["company","Customer"],["risk","Risk"],["stage","Stage"],["value","Value"]].map(([k,l])=><th key={k} style={{...S.th,cursor:"pointer"}} onClick={()=>toggleSort(k)}>{l}{arr(k)}</th>)}<th style={S.th}>Project</th><th style={S.th}>Services</th><th style={S.th}>MRR</th><th style={S.th}>Progress</th><th style={S.th}>Install</th><th style={S.th}>Owners</th></tr></thead>
    <tbody>{filtered.map(p=>{const cust=getCust(p);const {score,flags}=calcRisk(p);const rc=riskColor(score);const val=(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0);const mrr=calcMRR(p.services,p.lines);return <tr key={p.id} style={{cursor:"pointer",opacity:p.archived?0.55:1}} onClick={()=>onOpenProject(p)}><td style={{...S.td,borderLeft:"3px solid "+rc}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong>{p.archived&&<span style={{...S.badge("#64748b"),marginLeft:5,fontSize:9}}>archived</span>}{p.zohoLinked&&<span style={{...S.badge("#38bdf8"),marginLeft:4,fontSize:9}}>🔗</span>}</td><td style={S.td}><RiskBadge score={score}/>{flags.length>0&&<div style={{fontSize:9,color:"#4b5563",marginTop:2}}>{flags.join(", ")}</div>}</td><td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td><td style={{...S.td,fontWeight:600,color:"#fbbf24"}}>{val?f$(val):"—"}</td><td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td><td style={S.td}>{(p.services||[]).map(sv=><SvcBadge key={sv} sv={sv}/>)}</td><td style={{...S.td,color:"#4ade80",fontWeight:600}}>{mrr?f$(mrr)+"/mo":"—"}</td><td style={{...S.td,minWidth:120}}><ProgressBar pct={stageProgress(p.stage)} stage={p.stage}/></td><td style={S.td}>{p.installDate||"—"}</td><td style={S.td}><div style={{fontSize:10,color:"#4b5563",lineHeight:1.7}}>{p.assignedCA&&<div>CA: {p.assignedCA}</div>}{p.assignedPM&&<div>PM: {p.assignedPM}</div>}{p.assignedInstaller&&<div>🔧 {p.assignedInstaller}</div>}</div></td></tr>;})}
    </tbody></table></div></div>
  </div>;
}

// ── SALES VIEW ────────────────────────────────────────────────────────────────
function SalesView({projects,customers}){
  const active=projects.filter(p=>!["Closed","Handed to Support"].includes(p.stage)&&!p.archived);
  const closed=projects.filter(p=>["Closed","Handed to Support"].includes(p.stage));
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  return <div>
    <div style={S.alert("#38bdf8")}>👁 Sales view — read only.</div>
    <div style={{...S.flexWrap,marginBottom:14}}><StatCard l="Pipeline" v={f$(active.reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0))} c="#38bdf8"/><StatCard l="Active" v={active.length} c="#fbbf24"/><StatCard l="Closed Rev" v={f$(closed.reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0))} c="#4ade80"/><StatCard l="Total MRR" v={f$(active.reduce((a,p)=>a+calcMRR(p.services,p.lines),0))+"/mo"} c="#a78bfa"/></div>
    <div style={S.card}><div style={{...S.cardH,justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>Pipeline</span><button style={S.outBtn} onClick={()=>exportCSV(active.map(p=>{const c=getCust(p);return{Customer:c?.company,Rep:c?.rep,Project:p.name,Stage:p.stage,Lines:p.lines,EquipAmt:p.billing?.equipInvoiceAmount||0,InstallAmt:p.billing?.installInvoiceAmount||0,MRR:calcMRR(p.services,p.lines),InstallDate:p.installDate}}),"sales_pipeline")}>⬇ Export</button></div>
    <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Project","Stage","Risk","Services","Lines","Equip $","Install $","MRR","Install Date","Rep"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{[...projects].sort((a,b)=>ALL_STAGES.indexOf(a.stage)-ALL_STAGES.indexOf(b.stage)).map(p=>{const cust=getCust(p);const {score}=calcRisk(p);const mrr=calcMRR(p.services,p.lines);return <tr key={p.id}><td style={S.td}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong></td><td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td><td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td><td style={S.td}><RiskBadge score={score}/></td><td style={S.td}>{(p.services||[]).map(sv=><SvcBadge key={sv} sv={sv}/>)}</td><td style={S.td}>{p.lines}</td><td style={{...S.td,color:"#fbbf24",fontWeight:600}}>{p.billing?.equipInvoiceAmount?f$(p.billing.equipInvoiceAmount):"—"}</td><td style={{...S.td,color:"#fb923c",fontWeight:600}}>{p.billing?.installInvoiceAmount?f$(p.billing.installInvoiceAmount):"—"}</td><td style={{...S.td,color:"#4ade80",fontWeight:600}}>{mrr?f$(mrr)+"/mo":"—"}</td><td style={S.td}>{p.installDate||"—"}</td><td style={S.td}>{cust?.rep||"—"}</td></tr>;})} </tbody></table></div></div>
  </div>;
}

// ── CONTRACT ADMIN VIEW ───────────────────────────────────────────────────────
function ContractAdminView({projects,customers,staff,onOpen,onSave}){
  const [scope,setScope]=useState("mine");const [view,setView]=useState("list");
  const [filters,setFilters]=useState({search:"",assignee:"All",risk:"All",stage:"All"});
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const pending=projects.filter(p=>STAGES_CA.includes(p.stage)&&!p.archived);
  const base=scope==="mine"?pending:projects.filter(p=>!p.archived);
  const display=applyFilters(base,filters,"assignedCA",customers);
  function advance(p){const ns=NEXT_STAGE[p.stage];if(!ns||!canAdvance(p))return;onSave({...p,stage:ns,stageEnteredDate:todayStr});}
  return <div>
    <div style={{...S.flexWrap,marginBottom:14,alignItems:"center"}}>
      <StatCard l="CA Queue" v={pending.length} c="#e879f9"/>
      <StatCard l="Active" v={projects.filter(p=>!STAGES_CA.includes(p.stage)&&!["Closed","Handed to Support"].includes(p.stage)&&!p.archived).length} c="#4ade80"/>
      <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}><ViewToggle view={view} setView={setView}/><ScopeToggle scope={scope} setScope={setScope} label="CA Stages Only"/></div>
    </div>
    <FilterBar filters={filters} setFilters={setFilters} staff={staff} roleKey="Contract Admin" stageOptions={scope==="mine"?STAGES_CA:ALL_STAGES}/>
    {view==="kanban"
      ?<KanbanBoard stages={scope==="mine"?STAGES_CA:ALL_STAGES.slice(0,6)} projects={display} customers={customers} onOpen={onOpen} onAdvance={advance} accentField="assignedCA"/>
      :<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#e879f9"}}>📝 {scope==="mine"?"CA Queue":"All Projects"} ({display.length})</span></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Project","Stage","Risk","Assigned CA","Services","Equip $","Zoho","Gates","Action"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{display.map(p=>{const cust=getCust(p);const {score}=calcRisk(p);const ca=canAdvance(p);const ns=NEXT_STAGE[p.stage];const inStage=STAGES_CA.includes(p.stage);
        return <tr key={p.id} style={{cursor:"pointer",opacity:inStage||scope==="mine"?1:0.7}} onClick={()=>onOpen(p)}>
          <td style={{...S.td,borderLeft:"3px solid "+(inStage?"#e879f9":"#1e2d45")}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong><br/><span style={{fontSize:10,color:"#4b5563"}}>{cust?.rep}</span></td>
          <td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td>
          <td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td>
          <td style={S.td}><RiskBadge score={score}/></td>
          <td style={S.td}>{p.assignedCA?<span style={{fontSize:11,color:"#e879f9",fontWeight:600}}>{p.assignedCA}</span>:<span style={S.badge("#f87171")}>⚠ Unassigned</span>}</td>
          <td style={S.td}>{(p.services||[]).length>0?(p.services||[]).map(sv=><SvcBadge key={sv} sv={sv}/>):<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={{...S.td,color:"#fbbf24",fontWeight:600}}>{(p.billing?.equipInvoiceAmount||0)>0?f$(p.billing.equipInvoiceAmount):<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={S.td}>{p.zohoDealId?<span style={S.badge("#38bdf8")}>🔗{p.zohoDealId}</span>:<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={S.td}>{ca?<span style={S.badge("#4ade80")}>✓</span>:<span style={S.badge("#f87171")}>🔒</span>}</td>
          <td style={S.td} onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:4}}>
            <button style={S.btn("#e879f9")} onClick={()=>onOpen(p)}>Edit</button>
            {inStage&&ns&&<button disabled={!ca} style={{...S.btn(ca?"#4ade80":"#374151",ca?"#000":"#6b7280"),cursor:ca?"pointer":"not-allowed",fontSize:11}} onClick={()=>advance(p)}>→</button>}
          </div></td>
        </tr>;})}
      </tbody></table></div></div>}
  </div>;
}

// ── PROJECT MANAGER VIEW ──────────────────────────────────────────────────────
function PMView({projects,customers,staff,onOpen,onSave}){
  const [scope,setScope]=useState("mine");const [view,setView]=useState("kanban");
  const [filters,setFilters]=useState({search:"",assignee:"All",risk:"All",stage:"All"});
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const pmStages=[...STAGES_PM,...STAGES_INS];
  const pmProjects=projects.filter(p=>pmStages.includes(p.stage)&&!p.archived);
  const base=scope==="mine"?pmProjects:projects.filter(p=>!p.archived);
  const display=applyFilters(base,filters,"assignedPM",customers);
  function advance(p){const ns=NEXT_STAGE[p.stage];if(!ns||!canAdvance(p))return;onSave({...p,stage:ns,stageEnteredDate:todayStr});}
  return <div>
    {pmProjects.filter(p=>calcRisk(p).score>=50).length>0&&<div style={S.alert("#f87171")}>🚫 High-risk: {pmProjects.filter(p=>calcRisk(p).score>=50).map(p=>getCust(p)?.company).join(", ")}</div>}
    <div style={{...S.flexWrap,marginBottom:10,alignItems:"center"}}>
      <StatCard l="PM Active" v={pmProjects.length} c="#38bdf8"/>
      <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}><ViewToggle view={view} setView={setView}/><ScopeToggle scope={scope} setScope={setScope} label="PM Stages Only"/></div>
    </div>
    <FilterBar filters={filters} setFilters={setFilters} staff={staff} roleKey="Project Manager" stageOptions={scope==="mine"?pmStages:ALL_STAGES}/>
    {view==="kanban"
      ?<div>{scope==="all"&&<div style={S.alert("#38bdf8")}>Kanban shows PM/Install stages. Use List view to see all stages.</div>}<KanbanBoard stages={pmStages.slice(0,10)} projects={display.filter(p=>pmStages.includes(p.stage))} customers={customers} onOpen={onOpen} onAdvance={advance} accentField="assignedPM"/></div>
      :<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>{scope==="mine"?"PM / Install Stages":"All Projects"} ({display.length})</span></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Project","Stage","Risk","Assigned PM","Installer","Install Date","Gates","Advance"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{[...display].sort((a,b)=>ALL_STAGES.indexOf(a.stage)-ALL_STAGES.indexOf(b.stage)).map(p=>{const cust=getCust(p);const {score}=calcRisk(p);const ca=canAdvance(p);const ns=NEXT_STAGE[p.stage];const inStage=pmStages.includes(p.stage);
        return <tr key={p.id} style={{cursor:"pointer",opacity:inStage||scope==="mine"?1:0.65}} onClick={()=>onOpen(p)}>
          <td style={{...S.td,borderLeft:"3px solid "+(inStage?"#38bdf8":"#1e2d45")}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong></td>
          <td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td>
          <td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td>
          <td style={S.td}><RiskBadge score={score}/></td>
          <td style={S.td}>{p.assignedPM?<span style={{fontSize:11,color:"#38bdf8",fontWeight:600}}>{p.assignedPM}</span>:<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={S.td}>{p.assignedInstaller||<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={S.td}>{p.installDate||"—"}</td>
          <td style={S.td}>{ca?<span style={S.badge("#4ade80")}>✓</span>:<span style={S.badge("#f87171")}>🔒</span>}</td>
          <td style={S.td} onClick={e=>e.stopPropagation()}>{inStage&&ns&&<button disabled={!ca} style={{...S.btn(ca?SC[ns]||"#4ade80":"#374151",ca?"#000":"#6b7280"),cursor:ca?"pointer":"not-allowed",fontSize:11}} onClick={()=>advance(p)}>{ca?"→"+ns.split(" ")[0]:"Gated"}</button>}</td>
        </tr>;})}
      </tbody></table></div></div>}
  </div>;
}

// ── INSTALLER VIEW ────────────────────────────────────────────────────────────
function InstallerView({projects,customers,staff,onOpen}){
  const [scope,setScope]=useState("mine");const [view,setView]=useState("list");
  const [filters,setFilters]=useState({search:"",assignee:"All",risk:"All",stage:"All"});
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const jobs=projects.filter(p=>STAGES_INS.includes(p.stage)&&!p.archived);
  const surveys=projects.filter(p=>p.siteSurvey?.required&&["Required","Scheduled","Blocked"].includes(p.siteSurvey?.status));
  const base=scope==="mine"?jobs:projects.filter(p=>!p.archived);
  const display=applyFilters(base,filters,"assignedInstaller",customers).sort((a,b)=>(a.installDate||"")>(b.installDate||"")?1:-1);
  return <div>
    <div style={{...S.flexWrap,marginBottom:14,alignItems:"center"}}>
      <StatCard l="Active Jobs" v={jobs.length} c="#38bdf8"/>
      <StatCard l="Installing" v={jobs.filter(p=>p.stage==="Installing").length} c="#f87171"/>
      <StatCard l="Surveys Pending" v={surveys.length} c="#e879f9"/>
      <StatCard l="Unassigned" v={jobs.filter(p=>!p.assignedInstaller).length} c="#fbbf24"/>
      <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}><ViewToggle view={view} setView={setView}/><ScopeToggle scope={scope} setScope={setScope} label="Install Stages Only"/></div>
    </div>
    <FilterBar filters={filters} setFilters={setFilters} staff={staff} roleKey="Installer" stageOptions={scope==="mine"?STAGES_INS:ALL_STAGES}/>
    {surveys.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#e879f9"}}>🔍 Surveys ({surveys.length})</span></div>
    <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Status","Date","Tech","Report"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{surveys.map(p=>{const ss=p.siteSurvey||{};const cust=getCust(p);return <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>onOpen(p)}><td style={S.td}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong><br/><span style={{fontSize:10,color:"#4b5563"}}>{p.name}</span></td><td style={S.td}><span style={S.badge({"Completed":"#4ade80","Required":"#f87171","Scheduled":"#fbbf24","Blocked":"#f87171"}[ss.status]||"#4b5563")}>{ss.status}</span></td><td style={S.td}>{ss.date||<span style={S.badge("#f87171")}>Not Set</span>}</td><td style={S.td}>{ss.tech||<span style={S.badge("#f87171")}>Unassigned</span>}</td><td style={S.td}>{ss.reportAttached?<span style={S.badge("#4ade80")}>✓</span>:<span style={S.badge("#f87171")}>Missing</span>}</td></tr>;})} </tbody></table></div></div>}
    {view==="kanban"
      ?<KanbanBoard stages={STAGES_INS} projects={display.filter(p=>STAGES_INS.includes(p.stage))} customers={customers} onOpen={onOpen} onAdvance={()=>{}} accentField="assignedInstaller"/>
      :<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>🔧 {scope==="mine"?"Active Jobs":"All Projects"} ({display.length})</span></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Project","Stage","Risk","Assigned Installer","Check-In","Install Date"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{display.map(p=>{const {score}=calcRisk(p);const cust=getCust(p);const inStage=STAGES_INS.includes(p.stage);return <tr key={p.id} style={{cursor:"pointer",opacity:inStage||scope==="mine"?1:0.65}} onClick={()=>onOpen(p)}>
        <td style={{...S.td,borderLeft:"3px solid "+(inStage?"#fb923c":"#1e2d45")}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong></td>
        <td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td>
        <td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td>
        <td style={S.td}><RiskBadge score={score}/></td>
        <td style={S.td}>{p.assignedInstaller?<span style={{fontSize:11,color:"#fb923c",fontWeight:600}}>{p.assignedInstaller}</span>:<span style={S.badge("#f87171")}>⚠ Unassigned</span>}</td>
        <td style={S.td}>{p.installerCheckedIn?<span style={S.badge("#4ade80")}>✓</span>:<span style={S.badge("#4b5563")}>No</span>}</td>
        <td style={{...S.td,color:"#fb923c",fontWeight:600}}>{p.installDate||"—"}</td>
      </tr>;})} </tbody></table></div></div>}
  </div>;
}

// ── ACCOUNTING VIEW ───────────────────────────────────────────────────────────
function AccountingView({projects,customers,staff,onOpen,onSave}){
  const [scope,setScope]=useState("mine");const [view,setView]=useState("list");
  const [filters,setFilters]=useState({search:"",assignee:"All",risk:"All",stage:"All"});
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const accProjects=projects.filter(p=>STAGES_ACC.includes(p.stage)&&!p.archived);
  const base=scope==="mine"?accProjects:projects.filter(p=>!p.archived);
  const display=applyFilters(base,filters,"assignedAccounting",customers);
  const paid$=projects.filter(p=>p.billing?.paid).reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0);
  const invoiced$=projects.filter(p=>p.billing?.invoiced&&!p.billing?.paid).reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0),0);
  const totalMRR=projects.filter(p=>!p.archived&&!["Closed","Handed to Support"].includes(p.stage)).reduce((a,p)=>a+calcMRR(p.services,p.lines),0);
  const overdue=projects.filter(p=>p.billing?.invoiced&&!p.billing?.paid&&daysSince(p.billing?.equipInvoiceDate)>14);
  return <div>
    <div style={{...S.flexWrap,marginBottom:14,alignItems:"center"}}>
      <StatCard l="Collected" v={f$(paid$)} c="#4ade80"/>
      <StatCard l="Invoiced/Pending" v={f$(invoiced$)} c="#fbbf24"/>
      <StatCard l="MRR" v={f$(totalMRR)+"/mo"} c="#a78bfa"/>
      <div style={{display:"flex",gap:8,marginLeft:"auto",flexWrap:"wrap"}}><ViewToggle view={view} setView={setView}/><ScopeToggle scope={scope} setScope={setScope} label="Accounting Stages Only"/></div>
    </div>
    {overdue.length>0&&<div style={S.alert("#f87171")}>🔔 Overdue: {overdue.map(p=>getCust(p)?.company).join(", ")} — unpaid &gt;14 days.</div>}
    <FilterBar filters={filters} setFilters={setFilters} staff={staff} roleKey="Accounting" stageOptions={scope==="mine"?STAGES_ACC:ALL_STAGES}/>
    {view==="kanban"
      ?<KanbanBoard stages={scope==="mine"?STAGES_ACC:STAGES_ACC} projects={display.filter(p=>STAGES_ACC.includes(p.stage))} customers={customers} onOpen={onOpen} onAdvance={()=>{}} accentField="assignedAccounting"/>
      :<div style={S.card}><div style={{...S.cardH,justifyContent:"space-between"}}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>💰 {scope==="mine"?"Accounting Stages":"All Projects"} ({display.length})</span><button style={S.outBtn} onClick={()=>exportCSV(display.map(p=>{const c=getCust(p);const b=p.billing||{};return{Customer:c?.company,Project:p.name,EquipAmt:b.equipInvoiceAmount||0,InstallAmt:b.installInvoiceAmount||0,MRR:calcMRR(p.services,p.lines),EquipPaid:b.equipPaymentDate?"Yes":"No",InstallPaid:b.installPaymentDate?"Yes":"No",Accountant:p.assignedAccounting||""}}),"accounting_export")}>⬇ Export</button></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Customer","Project","Stage","Equip $","Install $","MRR","Accountant","Equip Paid","Install Paid","Action"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{display.map(p=>{const cust=getCust(p);const b=p.billing||{};const mrr=calcMRR(p.services,p.lines);const inStage=STAGES_ACC.includes(p.stage);const unpaidDays=b.invoiced&&!b.paid&&b.equipInvoiceDate?daysSince(b.equipInvoiceDate):0;
        return <tr key={p.id} style={{cursor:"pointer",opacity:inStage||scope==="mine"?1:0.65}} onClick={()=>onOpen(p)}>
          <td style={{...S.td,borderLeft:"3px solid "+(inStage?"#4ade80":"#1e2d45")}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong><br/><span style={{fontSize:10,color:"#4b5563"}}>{cust?.rep}</span></td>
          <td style={S.td}><span style={{fontSize:11,color:"#94a3b8"}}>{p.name}</span></td>
          <td style={S.td}><StageBadge stage={p.stage}/></td>
          <td style={{...S.td,color:"#fbbf24",fontWeight:600}}>{b.equipInvoiceAmount?f$(b.equipInvoiceAmount):"—"}</td>
          <td style={{...S.td,color:"#fb923c",fontWeight:600}}>{b.installInvoiceAmount?f$(b.installInvoiceAmount):"—"}</td>
          <td style={{...S.td,color:"#4ade80",fontWeight:600}}>{mrr?f$(mrr)+"/mo":"—"}</td>
          <td style={S.td}>{p.assignedAccounting?<span style={{fontSize:11,color:"#4ade80",fontWeight:600}}>{p.assignedAccounting}</span>:<span style={S.badge("#f87171")}>⚠</span>}</td>
          <td style={S.td}>{b.equipPaymentDate?<span style={S.badge("#4ade80")}>✓{b.equipPaymentDate}</span>:b.invoiced?<span style={S.badge("#f87171")}>{unpaidDays>0?unpaidDays+"d":"Inv."}</span>:<span style={S.badge("#4b5563")}>No</span>}</td>
          <td style={S.td}>{b.installPaymentDate?<span style={S.badge("#4ade80")}>✓</span>:<span style={S.badge("#4b5563")}>No</span>}</td>
          <td style={S.td} onClick={e=>e.stopPropagation()}><div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
            {!b.invoiced&&p.stage==="Install Complete"&&<button style={{...S.btn("#f59e0b"),fontSize:10,padding:"4px 8px"}} onClick={()=>onSave({...p,billing:{...b,invoiced:true,equipInvoiceDate:todayStr}})}>📄 Invoice</button>}
            {b.invoiced&&!b.equipPaymentDate&&<button style={{...S.btn("#4ade80","#000"),fontSize:10,padding:"4px 8px"}} onClick={()=>onSave({...p,billing:{...b,equipPaymentDate:todayStr,paid:true}})}>✓ Equip Paid</button>}
            {b.equipPaymentDate&&!b.installPaymentDate&&b.installInvoiceAmount>0&&<button style={{...S.btn("#fb923c"),fontSize:10,padding:"4px 8px"}} onClick={()=>onSave({...p,billing:{...b,installPaymentDate:todayStr}})}>✓ Install Paid</button>}
          </div></td>
        </tr>;})}
      </tbody></table></div></div>}
  </div>;
}

// ── TASKS VIEW ────────────────────────────────────────────────────────────────
function TasksView({projects,customers,staff,onSave}){
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const [scope,setScope]=useState("mine");const [fRole,setFRole]=useState("All");const [fDone,setFDone]=useState("Pending");const [fAssignee,setFAssignee]=useState("All");const [expanded,setExpanded]=useState({});
  const taskDefs=Object.entries(defaultTasks()).map(([id,t])=>({id,...t}));
  const active=projects.filter(p=>!p.archived);
  const pending=useMemo(()=>{let n=0;active.forEach(p=>taskDefs.forEach(d=>{if(!p.tasks?.[d.id]?.done)n++;}));return n;},[active]);
  const roleKeys={"Contract Admin":["ca_welcome_email","ca_confirm_call","ca_call_complete","ca_handoff_pm"],"Project Manager":["pm_project_plan","pm_kickoff","pm_training"],"Installer":["ins_schedule_survey","ins_complete_survey","ins_survey_report","ins_lines_tested","ins_report","ins_pm_notified"],"Accounting":["acc_send_invoice","acc_confirm_payment"]};
  const roleAssignField={"Contract Admin":"assignedCA","Project Manager":"assignedPM","Installer":"assignedInstaller","Accounting":"assignedAccounting"};
  const ROLE_STAGES={"Contract Admin":STAGES_CA,"Project Manager":[...STAGES_PM,...STAGES_INS],"Installer":STAGES_INS,"Accounting":STAGES_ACC};
  const assignees=staff.filter(s=>s.active&&(fRole==="All"||s.roles.includes(fRole)));
  const base=active.filter(p=>scope==="mine"&&fRole!=="All"?ROLE_STAGES[fRole].includes(p.stage):true);
  const visible=useMemo(()=>base.filter(p=>{
    if(fAssignee!=="All"){const af=roleAssignField[fRole];if(!af||p[af]!==fAssignee)return false;}
    const keys=fRole==="All"?taskDefs.map(d=>d.id):roleKeys[fRole]||[];
    return keys.some(k=>{const t=p.tasks?.[k];return fDone==="All"||(fDone==="Pending"&&(!t||!t.done))||(fDone==="Done"&&t?.done);});
  }),[base,fRole,fDone,fAssignee]);
  const ss={...S.sel,padding:"6px 9px",fontSize:11};
  return <div>
    <div style={{...S.flexWrap,marginBottom:14,alignItems:"center"}}>
      <StatCard l="Pending Tasks" v={pending} c="#f87171"/>
      <StatCard l="Active Projects" v={active.length} c="#38bdf8"/>
      <div style={{marginLeft:"auto"}}><ScopeToggle scope={scope} setScope={setScope} label="Role Stages Only"/></div>
    </div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div style={{flex:"1 1 130px"}}><label style={S.lbl}>Role</label><select style={ss} value={fRole} onChange={e=>{setFRole(e.target.value);setFAssignee("All");}}>{["All","Contract Admin","Project Manager","Installer","Accounting"].map(r=><option key={r}>{r}</option>)}</select></div>
      {assignees.length>0&&<div style={{flex:"1 1 140px"}}><label style={S.lbl}>Assignee</label><select style={ss} value={fAssignee} onChange={e=>setFAssignee(e.target.value)}><option value="All">All</option>{assignees.map(s=><option key={s.id}>{s.name}</option>)}</select></div>}
      <div style={{flex:"1 1 100px"}}><label style={S.lbl}>Status</label><select style={ss} value={fDone} onChange={e=>setFDone(e.target.value)}>{["All","Pending","Done"].map(v=><option key={v}>{v}</option>)}</select></div>
      <button style={S.outBtn} onClick={()=>{setFRole("All");setFDone("Pending");setFAssignee("All");}}>Reset</button>
    </div>
    {visible.map(p=>{const cust=getCust(p);const tasks=p.tasks||defaultTasks();const done=taskDefs.filter(d=>tasks[d.id]?.done).length;const {score}=calcRisk(p);const rc=riskColor(score);
      return <div key={p.id} style={{...S.card,borderLeft:"3px solid "+rc}}>
        <div style={{...S.cardH,cursor:"pointer"}} onClick={()=>setExpanded(e=>({...e,[p.id]:!e[p.id]}))}>
          <div style={{flex:1,display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}><span style={{fontWeight:700,color:"#f1f5f9"}}>{cust?.company}</span><span style={{fontSize:11,color:"#4b5563"}}>{p.name}</span><StageBadge stage={p.stage}/><RiskBadge score={score}/></div>
          <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{background:"#0d1628",borderRadius:999,height:6,width:80,overflow:"hidden"}}><div style={{width:(done/taskDefs.length*100)+"%",height:"100%",background:done===taskDefs.length?"#4ade80":"#38bdf8",borderRadius:999}}/></div><span style={{fontSize:11,color:"#4b5563"}}>{done}/{taskDefs.length}</span><span style={{fontSize:12,color:"#4b5563"}}>{expanded[p.id]?"▲":"▼"}</span></div>
        </div>
        {expanded[p.id]&&<div style={{padding:14}}><TasksPanel o={p} onChange={tasks=>onSave({...p,tasks})}/></div>}
      </div>;
    })}
    {visible.length===0&&<div style={{background:"#111827",borderRadius:10,border:"1px solid #1e2d45",padding:40,textAlign:"center",color:"#4b5563"}}>No tasks match filters.</div>}
  </div>;
}

// ── INVENTORY VIEW ────────────────────────────────────────────────────────────
function ItemModal({item,onSave,onClose,onDelete}){
  const [f,setF]=useState({...item});const u=(k,v)=>setF(p=>({...p,[k]:v}));
  return <Modal zIndex={1200} width={500} onClose={onClose}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:16}}><span style={{fontWeight:800,fontSize:15,color:"#f1f5f9"}}>{item._exists?"Edit Item":"New Item"}</span><button style={S.outBtn} onClick={onClose}>✕</button></div>
      <div style={S.grid2}>
        <div><label style={S.lbl}>Category *</label><select style={S.sel} value={f.category} onChange={e=>u("category",e.target.value)}>{ITEM_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div><label style={S.lbl}>Condition *</label><select style={S.sel} value={f.condition} onChange={e=>u("condition",e.target.value)}><option value="new">🟢 New</option><option value="refurbished">🟡 Refurbished</option></select></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Model / Name *</label><input style={S.inp} value={f.model} onChange={e=>u("model",e.target.value)}/></div>
        <div><label style={S.lbl}>SKU</label><input style={S.inp} value={f.sku||""} onChange={e=>u("sku",e.target.value)}/></div>
        <div><label style={S.lbl}>Unit Cost ($)</label><input style={S.inp} type="number" value={f.unitCost||0} onChange={e=>u("unitCost",+e.target.value)}/></div>
        <div><label style={S.lbl}>Total Qty on Hand</label><input style={S.inp} type="number" value={f.totalQty||0} onChange={e=>u("totalQty",+e.target.value)}/></div>
        <div><label style={S.lbl}>Low Stock Threshold</label><input style={S.inp} type="number" value={f.low||0} onChange={e=>u("low",+e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={S.lbl}>Notes</label><input style={S.inp} value={f.notes||""} onChange={e=>u("notes",e.target.value)}/></div>
        <div style={{gridColumn:"1/-1"}}><label style={{fontSize:12,display:"flex",gap:6,alignItems:"center"}}><input type="checkbox" checked={!!f.active} onChange={e=>u("active",e.target.checked)}/>Active</label></div>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",marginTop:16,flexWrap:"wrap",gap:8}}>
        {item._exists&&<button style={S.btn("#ef4444")} onClick={()=>onDelete(item.id)}>Delete</button>}
        <div style={{display:"flex",gap:8,marginLeft:"auto"}}><button style={S.outBtn} onClick={onClose}>Cancel</button><button style={S.btn()} onClick={()=>{if(f.model.trim())onSave(f);}}>Save</button></div>
      </div>
  </Modal>;
}

function InventoryView({projects,pool,setPool}){
  const [catFilter,setCatFilter]=useState("All");const [condFilter,setCondFilter]=useState("All");const [showInactive,setShowInactive]=useState(false);const [adjVals,setAdjVals]=useState({});const [editItem,setEditItem]=useState(null);const [invTab,setInvTab]=useState("stock");
  const synced=useMemo(()=>syncCatalog(projects,pool),[projects,pool]);
  const visible=useMemo(()=>synced.filter(item=>{if(!showInactive&&!item.active)return false;if(catFilter!=="All"&&item.category!==catFilter)return false;if(condFilter!=="All"&&item.condition!==condFilter)return false;return true;}),[synced,catFilter,condFilter,showInactive]);
  function adj(id,d){setPool(p=>p.map(x=>x.id===id?{...x,totalQty:Math.max(0,x.totalQty+d)}:x));}
  function bulkAdd(id){const v=parseInt(adjVals[id]||0);if(v){adj(id,v);setAdjVals(p=>({...p,[id]:""}));}}
  function saveItem(f){if(f._exists)setPool(p=>p.map(x=>x.id===f.id?{...f}:x));else{const{_exists,...rest}=f;setPool(p=>[...p,{...rest,id:"itm_"+(itemIdSeq++)}]);}setEditItem(null);}
  function deleteItem(id){setPool(p=>p.filter(x=>x.id!==id));setEditItem(null);}
  const catSummary=useMemo(()=>ITEM_CATEGORIES.map(cat=>{const items=synced.filter(i=>i.category===cat&&i.active);const short=items.filter(i=>(i.totalQty-i.reserved)<0).length;const low=items.filter(i=>(i.totalQty-i.reserved)>=0&&(i.totalQty-i.reserved)<=i.low).length;return{cat,count:items.length,short,low};}).filter(c=>c.count>0),[synced]);
  const totalValue=synced.reduce((a,i)=>a+i.totalQty*(i.unitCost||0),0);
  const ss={...S.sel,padding:"6px 9px",fontSize:11};
  return <div>
    <div style={{...S.flexWrap,marginBottom:14}}>
      <StatCard l="Shortages" v={synced.filter(i=>(i.totalQty-i.reserved)<0&&i.active).length} c="#f87171"/>
      <StatCard l="Low Stock" v={synced.filter(i=>(i.totalQty-i.reserved)>=0&&(i.totalQty-i.reserved)<=i.low&&i.active).length} c="#fbbf24"/>
      <StatCard l="SKUs" v={synced.filter(i=>i.active).length} c="#38bdf8"/>
      <StatCard l="Inventory Value" v={f$(totalValue)} c="#4ade80"/>
    </div>
    <div style={{display:"flex",gap:7,flexWrap:"wrap",marginBottom:12}}>
      {catSummary.map(c=><button key={c.cat} onClick={()=>setCatFilter(catFilter===c.cat?"All":c.cat)} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 11px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"2px solid "+(catFilter===c.cat?CAT_COLOR[c.cat]:"#1e2d45"),background:catFilter===c.cat?CAT_COLOR[c.cat]+"22":"#111827",color:catFilter===c.cat?CAT_COLOR[c.cat]:"#4b5563"}}>{CAT_ICON[c.cat]} {c.cat}{c.short>0&&<span style={{...S.badge("#f87171"),fontSize:9,padding:"1px 5px"}}>⚠{c.short}</span>}{c.short===0&&c.low>0&&<span style={{...S.badge("#fbbf24"),fontSize:9,padding:"1px 5px"}}>low</span>}</button>)}
    </div>
    <div style={{display:"flex",borderBottom:"1px solid #1e2d45",marginBottom:12}}>{[["stock","📦 Stock"],["catalog","🗂 Catalog"]].map(([v,l])=><button key={v} style={tabStyle(invTab===v)} onClick={()=>setInvTab(v)}>{l}</button>)}</div>
    {invTab==="stock"&&<div>
      <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
        <div style={{flex:"1 1 120px"}}><label style={S.lbl}>Category</label><select style={ss} value={catFilter} onChange={e=>setCatFilter(e.target.value)}><option>All</option>{ITEM_CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{flex:"1 1 110px"}}><label style={S.lbl}>Condition</label><select style={ss} value={condFilter} onChange={e=>setCondFilter(e.target.value)}><option>All</option><option value="new">New</option><option value="refurbished">Refurbished</option></select></div>
        <label style={{fontSize:12,display:"flex",gap:5,alignItems:"center"}}><input type="checkbox" checked={showInactive} onChange={e=>setShowInactive(e.target.checked)}/>Show inactive</label>
        <button style={S.outBtn} onClick={()=>exportCSV(visible.map(i=>({Category:i.category,Model:i.model,Condition:i.condition,SKU:i.sku,Total:i.totalQty,Reserved:i.reserved,Available:i.totalQty-i.reserved,UnitCost:i.unitCost,Status:(i.totalQty-i.reserved)<0?"SHORT":(i.totalQty-i.reserved)<=i.low?"Low":"OK"})),"inventory_export")}>⬇ Export</button>
      </div>
      <div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>Stock Levels ({visible.length} SKUs)</span></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Category","Model","Condition","SKU","Total","Res","Avail","Unit $","Status","±","Receive"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead>
      <tbody>{visible.map(item=>{const avail=item.totalQty-item.reserved;const isShort=avail<0;const isLow=!isShort&&avail<=item.low;return <tr key={item.id} style={{opacity:item.active?1:0.45}}>
        <td style={S.td}><span style={{...S.badge(CAT_COLOR[item.category]||"#64748b"),fontSize:9}}>{CAT_ICON[item.category]} {item.category}</span></td>
        <td style={S.td}><button onClick={()=>setEditItem({...item,_exists:true})} style={{background:"none",border:"none",color:"#f1f5f9",fontWeight:700,fontSize:12,cursor:"pointer",padding:0,textAlign:"left"}}>{item.model}</button>{item.notes&&<div style={{fontSize:9,color:"#4b5563"}}>{item.notes}</div>}</td>
        <td style={S.td}><span style={S.badge(item.condition==="new"?"#4ade80":"#fbbf24")}>{item.condition==="new"?"🟢 New":"🟡 Refurb"}</span></td>
        <td style={{...S.td,fontSize:10,color:"#4b5563",fontFamily:"monospace"}}>{item.sku||"—"}</td>
        <td style={S.td}>{item.totalQty}</td><td style={S.td}>{item.reserved}</td>
        <td style={{...S.td,fontWeight:700,color:isShort?"#f87171":isLow?"#fbbf24":"#4ade80"}}>{avail}</td>
        <td style={{...S.td,color:"#94a3b8",fontSize:11}}>{item.unitCost?f$(item.unitCost):"—"}</td>
        <td style={S.td}>{isShort?<span style={S.badge("#f87171")}>⚠ SHORT</span>:isLow?<span style={S.badge("#fbbf24")}>Low</span>:<span style={S.badge("#4ade80")}>OK</span>}</td>
        <td style={S.td}><div style={{display:"flex",gap:3}}><button style={{background:"transparent",color:"#94a3b8",border:"1px solid #1e2d45",borderRadius:5,padding:"2px 6px",cursor:"pointer"}} onClick={()=>adj(item.id,-1)}>−</button><button style={{...S.btn(),padding:"2px 6px"}} onClick={()=>adj(item.id,1)}>+</button></div></td>
        <td style={S.td}><div style={{display:"flex",gap:3}}><input type="number" placeholder="qty" style={{...S.inp,width:50,padding:"4px 5px",fontSize:11}} value={adjVals[item.id]||""} onChange={e=>setAdjVals(v=>({...v,[item.id]:e.target.value}))}/><button style={{...S.btn("#10b981"),fontSize:10,padding:"4px 7px"}} onClick={()=>bulkAdd(item.id)}>+</button></div></td>
      </tr>;})} </tbody></table></div></div>
    </div>}
    {invTab==="catalog"&&<div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:8}}><span style={{fontSize:13,color:"#94a3b8"}}>Manage SKUs, models, and item types.</span><button style={S.btn()} onClick={()=>setEditItem(mkItem({_exists:false}))}>+ New Item</button></div>
      {ITEM_CATEGORIES.map(cat=>{const items=synced.filter(i=>i.category===cat);if(!items.length)return null;return <div key={cat} style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:CAT_COLOR[cat]}}>{CAT_ICON[cat]} {cat} <span style={{color:"#4b5563",fontWeight:400,fontSize:11}}>({items.length} SKUs)</span></span></div>
      <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>{["Model","Condition","SKU","Unit $","On Hand","Low","Status","Active","Edit"].map(h=><th key={h} style={S.th}>{h}</th>)}</tr></thead><tbody>{items.map(item=>{const avail=item.totalQty-item.reserved;const isShort=avail<0;const isLow=!isShort&&avail<=item.low;return <tr key={item.id} style={{opacity:item.active?1:0.45}}><td style={S.td}><strong style={{color:"#f1f5f9"}}>{item.model}</strong></td><td style={S.td}><span style={S.badge(item.condition==="new"?"#4ade80":"#fbbf24")}>{item.condition==="new"?"🟢 New":"🟡 Refurb"}</span></td><td style={{...S.td,fontFamily:"monospace",fontSize:10,color:"#4b5563"}}>{item.sku||"—"}</td><td style={{...S.td,color:"#94a3b8"}}>{item.unitCost?f$(item.unitCost):"—"}</td><td style={S.td}>{item.totalQty}</td><td style={S.td}>{item.low}</td><td style={S.td}>{isShort?<span style={S.badge("#f87171")}>SHORT</span>:isLow?<span style={S.badge("#fbbf24")}>Low</span>:<span style={S.badge("#4ade80")}>OK</span>}</td><td style={S.td}><button onClick={()=>setPool(p=>p.map(x=>x.id===item.id?{...x,active:!x.active}:x))} style={{...S.badge(item.active?"#4ade80":"#4b5563"),cursor:"pointer",border:"none"}}>{item.active?"Yes":"No"}</button></td><td style={S.td}><button style={S.btn("#374151")} onClick={()=>setEditItem({...item,_exists:true})}>Edit</button></td></tr>;})} </tbody></table></div></div>;})}
      <div style={{marginTop:10,textAlign:"center"}}><button style={S.btn()} onClick={()=>setEditItem(mkItem({_exists:false}))}>+ Add New Item</button></div>
    </div>}
    {editItem&&<ItemModal item={editItem} onSave={saveItem} onClose={()=>setEditItem(null)} onDelete={deleteItem}/>}
  </div>;
}

// ── SEARCH VIEW ───────────────────────────────────────────────────────────────
function SearchView({customers,projects,staff,onOpenProject,onSelectCustomer}){
  const [q,setQ]=useState("");
  const results=useMemo(()=>{if(!q.trim()||q.trim().length<2)return{customers:[],projects:[],staff:[]};const ql=q.toLowerCase();return{customers:customers.filter(c=>c.company.toLowerCase().includes(ql)||c.contact.toLowerCase().includes(ql)||(c.zohoAccountId||"").toLowerCase().includes(ql)||(c.phone||"").includes(ql)),projects:projects.filter(p=>{const cust=customers.find(c=>c.id===p.customerId);return(cust?.company||"").toLowerCase().includes(ql)||p.name.toLowerCase().includes(ql)||(p.zohoDealId||"").toLowerCase().includes(ql)||(p.notes||"").toLowerCase().includes(ql)||p.contactLog?.some(l=>l.text.toLowerCase().includes(ql));}),staff:staff.filter(s=>s.name.toLowerCase().includes(ql)||(s.email||"").toLowerCase().includes(ql)||(s.roles||[]).some(r=>r.toLowerCase().includes(ql)))};},[q,customers,projects,staff]);
  const hasResults=results.customers.length>0||results.projects.length>0||results.staff.length>0;
  return <div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:10,padding:"16px 20px",marginBottom:16}}><div style={{fontSize:14,fontWeight:700,color:"#f1f5f9",marginBottom:10}}>🔍 Global Search</div><input style={{...S.inp,fontSize:15,padding:"12px 14px"}} placeholder="Search customers, projects, staff, Zoho IDs, contact logs…" value={q} onChange={e=>setQ(e.target.value)} autoFocus/><div style={{fontSize:11,color:"#4b5563",marginTop:6}}>Searches customers, projects (including archived), staff, Zoho IDs, contact logs, and notes.</div></div>
    {q.length>=2&&!hasResults&&<div style={{textAlign:"center",color:"#4b5563",padding:30}}>No results for "{q}".</div>}
    {results.customers.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#38bdf8"}}>👤 Customers ({results.customers.length})</span></div>{results.customers.map(c=><div key={c.id} onClick={()=>onSelectCustomer(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #0d1628",cursor:"pointer"}}><div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{c.company}</div><div style={{fontSize:11,color:"#4b5563"}}>{c.contact} · {c.phone}</div></div>{c.zohoAccountId&&<span style={S.badge("#38bdf8")}>{c.zohoAccountId}</span>}<span style={{fontSize:11,color:"#38bdf8"}}>View →</span></div>)}</div>}
    {results.projects.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#a78bfa"}}>📋 Projects ({results.projects.length})</span></div>{results.projects.map(p=>{const cust=customers.find(c=>c.id===p.customerId);const{score}=calcRisk(p);return <div key={p.id} onClick={()=>onOpenProject(p)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #0d1628",cursor:"pointer"}}><div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{cust?.company} — {p.name}</div><div style={{fontSize:11,color:"#4b5563"}}>{p.zohoDealId&&"Zoho: "+p.zohoDealId+" · "}Stage: {p.stage}</div></div><StageBadge stage={p.stage}/><RiskBadge score={score}/>{p.archived&&<span style={S.badge("#64748b")}>archived</span>}</div>;})} </div>}
    {results.staff.length>0&&<div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#4ade80"}}>👥 Staff ({results.staff.length})</span></div>{results.staff.map(s=><div key={s.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:"1px solid #0d1628"}}><div style={{flex:1}}><div style={{fontWeight:700,color:"#f1f5f9"}}>{s.name}</div><div style={{fontSize:11,color:"#4b5563"}}>{s.email}</div></div>{s.roles.map(r=><span key={r} style={{...S.badge(ROLE_COLOR[r]||"#64748b"),fontSize:9,marginRight:3}}>{ROLE_ICON[r]} {r}</span>)}</div>)}</div>}
  </div>;
}

// ── OVERVIEW VIEW ─────────────────────────────────────────────────────────────
function OverviewView({projects,customers,onOpen}){
  const [groupFilter,setGroupFilter]=useState("All");
  const [repFilter,setRepFilter]=useState("All");
  const [statusFilter,setStatusFilter]=useState("All");
  const [sortKey,setSortKey]=useState("risk");
  const [sortDir,setSortDir]=useState("desc");
  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const reps=useMemo(()=>["All",...[...new Set(customers.map(c=>c.rep).filter(Boolean))].sort()],[customers]);
  const STAGE_GROUPS={"Pre-Contract":STAGES_CA,"PM Pipeline":STAGES_PM,"Operations":STAGES_INS,"Complete":STAGES_ACC};
  function toggleSort(k){if(sortKey===k)setSortDir(d=>d==="asc"?"desc":"asc");else{setSortKey(k);setSortDir("desc");}}
  function arr(k){return sortKey!==k?" ↕":sortDir==="asc"?" ↑":" ↓";}
  const filtered=useMemo(()=>{
    let list=[...projects].filter(p=>!["Closed","Handed to Support"].includes(p.stage));
    if(groupFilter!=="All"){const stages=STAGE_GROUPS[groupFilter]||[];list=list.filter(p=>stages.includes(p.stage));}
    if(repFilter!=="All")list=list.filter(p=>getCust(p)?.rep===repFilter);
    if(statusFilter!=="All")list=list.filter(p=>{const{score,flags}=calcRisk(p);if(statusFilter==="Blocked")return flags.includes("blocked");if(statusFilter==="Aging")return flags.includes("aging")&&!flags.includes("blocked");if(statusFilter==="On Track")return score<25;if(statusFilter==="Unpaid")return flags.includes("unpaid");return true;});
    return list.sort((a,b)=>{let av,bv;if(sortKey==="company"){av=(getCust(a)?.company||"").toLowerCase();bv=(getCust(b)?.company||"").toLowerCase();}else if(sortKey==="stage"){av=ALL_STAGES.indexOf(a.stage);bv=ALL_STAGES.indexOf(b.stage);}else if(sortKey==="risk"){av=calcRisk(a).score;bv=calcRisk(b).score;}else if(sortKey==="revenue"){av=(a.billing?.equipInvoiceAmount||0)+(a.billing?.installInvoiceAmount||0);bv=(b.billing?.equipInvoiceAmount||0)+(b.billing?.installInvoiceAmount||0);}else if(sortKey==="install"){av=a.installDate||"";bv=b.installDate||"";}else if(sortKey==="days"){av=a.stageEnteredDate?daysSince(a.stageEnteredDate):0;bv=b.stageEnteredDate?daysSince(b.stageEnteredDate):0;}else{av=0;bv=0;}return sortDir==="asc"?(av<bv?-1:av>bv?1:0):(av>bv?-1:av<bv?1:0);});
  },[projects,groupFilter,repFilter,statusFilter,sortKey,sortDir]);
  const ss={...S.sel,padding:"6px 9px",fontSize:11};
  return <div>
    <div style={{...S.flexWrap,marginBottom:14}}>
      <StatCard l="Shown" v={filtered.length} c="#38bdf8"/>
      <StatCard l="Blocked" v={filtered.filter(p=>calcRisk(p).flags?.includes("blocked")).length} c="#f87171"/>
      <StatCard l="Revenue" v={f$(filtered.reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0),0))} c="#fbbf24"/>
      <StatCard l="MRR" v={f$(filtered.reduce((a,p)=>a+calcMRR(p.services,p.lines),0))+"/mo"} c="#4ade80"/>
    </div>
    <div style={{background:"#111827",border:"1px solid #1e2d45",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
      <div style={{flex:"1 1 130px"}}><label style={S.lbl}>Stage Group</label><select style={ss} value={groupFilter} onChange={e=>setGroupFilter(e.target.value)}><option>All</option>{Object.keys(STAGE_GROUPS).map(g=><option key={g}>{g}</option>)}</select></div>
      <div style={{flex:"1 1 130px"}}><label style={S.lbl}>Rep</label><select style={ss} value={repFilter} onChange={e=>setRepFilter(e.target.value)}>{reps.map(r=><option key={r}>{r}</option>)}</select></div>
      <div style={{flex:"1 1 120px"}}><label style={S.lbl}>Status</label><select style={ss} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>{["All","Blocked","Aging","On Track","Unpaid"].map(v=><option key={v}>{v}</option>)}</select></div>
      <button style={S.outBtn} onClick={()=>{setGroupFilter("All");setRepFilter("All");setStatusFilter("All");}}>Reset</button>
    </div>
    <div style={S.card}><div style={S.cardH}><span style={{fontWeight:700,fontSize:13,color:"#f1f5f9"}}>All Active Orders — {filtered.length}</span></div>
    <div style={{overflowX:"auto"}}><table style={S.tbl}><thead><tr>
      {[["company","Company"],["stage","Stage"],["risk","Risk Score"],["revenue","Revenue"],["install","Install Date"],["days","Days in Stage"]].map(([k,l])=>
        <th key={k} style={{...S.th,cursor:"pointer"}} onClick={()=>toggleSort(k)}>{l}{arr(k)}</th>
      )}
      <th style={S.th}>Rep</th><th style={S.th}>Owners</th>
    </tr></thead>
    <tbody>{filtered.map(p=>{
      const cust=getCust(p);const{score,flags}=calcRisk(p);const rc=riskColor(score);
      const val=(p.billing?.equipInvoiceAmount||0)+(p.billing?.installInvoiceAmount||0);
      const daysIn=p.stageEnteredDate?daysSince(p.stageEnteredDate):0;
      const lim=BOTTLENECK[p.stage]||5;
      return <tr key={p.id} style={{cursor:"pointer"}} onClick={()=>onOpen(p)}>
        <td style={{...S.td,borderLeft:"3px solid "+rc}}><strong style={{color:"#f1f5f9"}}>{cust?.company}</strong><div style={{fontSize:10,color:"#4b5563"}}>{p.name}</div></td>
        <td style={S.td}><StageBadge stage={p.stage}/><AgingPill p={p}/></td>
        <td style={S.td}><RiskBadge score={score}/>{flags.length>0&&<div style={{fontSize:9,color:"#4b5563",marginTop:2}}>{flags.join(", ")}</div>}</td>
        <td style={{...S.td,fontWeight:600,color:"#fbbf24"}}>{val?f$(val):"—"}</td>
        <td style={{...S.td,color:"#fb923c"}}>{p.installDate||"—"}</td>
        <td style={{...S.td,fontWeight:700,color:daysIn>=lim?"#f87171":daysIn>=lim*0.7?"#fbbf24":"#4ade80"}}>{daysIn}d</td>
        <td style={S.td}>{cust?.rep||"—"}</td>
        <td style={S.td}><div style={{fontSize:10,color:"#4b5563",lineHeight:1.7}}>{p.assignedCA&&<div>CA: {p.assignedCA}</div>}{p.assignedPM&&<div>PM: {p.assignedPM}</div>}{p.assignedInstaller&&<div>🔧 {p.assignedInstaller}</div>}</div></td>
      </tr>;
    })}</tbody></table></div></div>
  </div>;
}

// ── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App(){
  const [customers,setCustomers]=useState(CUSTOMERS0);
  const [projects,setProjects]=useState(PROJECTS0);
  const [pool,setPool]=useState(INV_CATALOG0);
  const [staff,setStaff]=useState(STAFF0);
  const [role,setRole]=useState("Today");
  const [projectModal,setProjectModal]=useState(null);
  const [customerModal,setCustomerModal]=useState(null);
  const [staffModal,setStaffModal]=useState(null);
  const [zohoModal,setZohoModal]=useState(null);
  const [zohoTargetCustId,setZohoTargetCustId]=useState(null);
  const [selectedCustomer,setSelectedCustomer]=useState(null);

  const syncedPool=useMemo(()=>syncCatalog(projects,pool),[projects,pool]);
  const activeProjects=projects.filter(p=>!p.archived);
  const critCount=useMemo(()=>activeProjects.filter(p=>calcRisk(p).score>=50).length,[activeProjects]);
  const unpaid$=useMemo(()=>activeProjects.filter(p=>p.billing?.invoiced&&!p.billing?.paid&&daysSince(p.billing?.equipInvoiceDate)>7).reduce((a,p)=>a+(p.billing?.equipInvoiceAmount||0),0),[activeProjects]);
  const totalMRR=useMemo(()=>activeProjects.filter(p=>!["Closed","Handed to Support"].includes(p.stage)).reduce((a,p)=>a+calcMRR(p.services,p.lines),0),[activeProjects]);

  function saveProject(f){if(f.id)setProjects(p=>p.map(x=>x.id===f.id?f:x));else setProjects(p=>[...p,{...f,id:projIdSeq++}]);setProjectModal(null);}
  function saveProjectNoClose(f){if(f.id)setProjects(p=>p.map(x=>x.id===f.id?f:x));else setProjects(p=>[...p,{...f,id:projIdSeq++}]);}
  function delProject(id){setProjects(p=>p.filter(x=>x.id!==id));setProjectModal(null);}
  function saveCustomer(f){if(f.id)setCustomers(c=>c.map(x=>x.id===f.id?f:x));else setCustomers(c=>[...c,{...f,id:custIdSeq++}]);setCustomerModal(null);}
  function delCustomer(id){setCustomers(c=>c.filter(x=>x.id!==id));setCustomerModal(null);}
  function saveStaff(f){if(f.id&&staff.find(s=>s.id===f.id))setStaff(s=>s.map(x=>x.id===f.id?f:x));else setStaff(s=>[...s,{...f,id:"st_"+(staffIdSeq++)}]);setStaffModal(null);}
  function delStaff(id){setStaff(s=>s.filter(x=>x.id!==id));setStaffModal(null);}

  function handleZohoImport(data){
    let cId=zohoTargetCustId;
    if(!cId){const nc=defaultCustomer({id:custIdSeq++,company:data.company,contact:data.contact,phone:data.phone,rep:data.rep,createdDate:todayStr});setCustomers(c=>[...c,nc]);cId=nc.id;}
    const np=defaultProject({id:projIdSeq++,customerId:cId,name:data.company+" — Zoho Import",zohoDealId:data.zohoDealId,zohoLinked:true,services:data.services||[],lines:data.lines||1,billing:{equipInvoiceAmount:data.equipInvoiceAmount||0,installInvoiceAmount:data.installInvoiceAmount||0,invoiced:false,paid:false},notes:data.notes||"",stage:"CRM Entry"});
    setProjects(p=>[...p,np]);setZohoModal(null);setZohoTargetCustId(null);setProjectModal(np);
  }

  const getCust=p=>customers.find(c=>c.id===p.customerId);
  const LABELS={"Today":"🏠 Today","Overview":"🗂 Overview","Customers":"👤 Customers","Projects":"📋 Projects","Sales":"💼 Sales","Contract Admin":"📝 CA","Project Manager":"📊 PM","Installer":"🔧 Installer","Inventory":"📦 Inventory","Accounting":"💰 Accounting","Tasks":"✅ Tasks","Staff":"👥 Staff","Search":"🔍 Search"};

  return <div style={S.app}>
    <div style={S.nav}>
      <span style={{fontSize:13,fontWeight:800,color:"#38bdf8",padding:"12px 10px 12px 0",whiteSpace:"nowrap",flexShrink:0}}>📡 Vaspian OS</span>
      {NAV_TABS.map(r=><button key={r} style={tabStyle(role===r)} onClick={()=>{setRole(r);setSelectedCustomer(null);}}>
        {LABELS[r]}{r==="Today"&&critCount>0&&<span style={{...S.badge("#f87171"),fontSize:9,marginLeft:4,verticalAlign:"middle"}}>{critCount}</span>}
        {r==="Staff"&&<span style={{...S.badge("#38bdf8"),fontSize:9,marginLeft:4,verticalAlign:"middle"}}>{staff.filter(s=>s.active).length}</span>}
      </button>)}
      <div style={{marginLeft:"auto",paddingLeft:6,display:"flex",gap:5,flexShrink:0}}>
        <button style={S.btn("#38bdf8","#000")} onClick={()=>{setZohoTargetCustId(null);setZohoModal(true);}}>🔗 Zoho</button>
        <button style={S.btn()} onClick={()=>setProjectModal(defaultProject({id:0,customerId:customers[0]?.id||0}))}>+ New</button>
      </div>
    </div>
    <div style={{background:"#080d1a",borderBottom:"1px solid #1e2d45",padding:"5px 14px",display:"flex",gap:16,alignItems:"center",fontSize:11,flexWrap:"wrap"}}>
      <span style={{color:"#f87171",fontWeight:700,cursor:"pointer"}} onClick={()=>setRole("Today")}>🔴 {critCount} critical</span>
      <span style={{color:"#fbbf24",fontWeight:700,cursor:"pointer"}} onClick={()=>setRole("Today")}>🟡 {activeProjects.filter(p=>{const s=calcRisk(p).score;return s>=25&&s<50;}).length} at risk</span>
      <span style={{color:"#f87171",fontWeight:700}}>💸 {f$(unpaid$)} unpaid</span>
      <span style={{color:"#4ade80",fontWeight:700}}>✓ {projects.filter(p=>p.billing?.paid).length} closed</span>
      <span style={{color:"#a78bfa",fontWeight:700}}>📈 MRR {f$(totalMRR)}/mo</span>
      <span style={{color:"#38bdf8",fontWeight:700}}>{customers.length} customers · {projects.length} projects · {staff.filter(s=>s.active).length} staff</span>
    </div>
    <div style={S.page}>
      {role==="Today"&&<TodayView projects={activeProjects} customers={customers} pool={syncedPool} onOpenProject={setProjectModal}/>}
      {role==="Overview"&&<OverviewView projects={activeProjects} customers={customers} onOpen={setProjectModal}/>}
      {role==="Customers"&&!selectedCustomer&&<CustomersView customers={customers} projects={projects} staff={staff} onEditCustomer={c=>setCustomerModal(c)} onNewCustomer={()=>setCustomerModal(defaultCustomer({id:0}))} onSelectCustomer={c=>setSelectedCustomer(c)}/>}
      {role==="Customers"&&selectedCustomer&&<CustomerDetail customer={selectedCustomer} projects={projects} onBack={()=>setSelectedCustomer(null)} onNewProject={()=>setProjectModal(defaultProject({id:0,customerId:selectedCustomer.id}))} onOpenProject={setProjectModal} onNewProjectFromZoho={()=>{setZohoTargetCustId(selectedCustomer.id);setZohoModal(true);}}/>}
      {role==="Projects"&&<ProjectsView projects={projects} customers={customers} onOpenProject={setProjectModal} onNewProject={()=>setProjectModal(defaultProject({id:0,customerId:customers[0]?.id||0}))}/>}
      {role==="Sales"&&<SalesView projects={projects} customers={customers}/>}
      {role==="Contract Admin"&&<ContractAdminView projects={projects} customers={customers} staff={staff} onOpen={setProjectModal} onSave={saveProject}/>}
      {role==="Project Manager"&&<PMView projects={projects} customers={customers} staff={staff} onOpen={setProjectModal} onSave={saveProject}/>}
      {role==="Installer"&&<InstallerView projects={projects} customers={customers} staff={staff} onOpen={setProjectModal}/>}
      {role==="Inventory"&&<InventoryView projects={projects} pool={pool} setPool={setPool}/>}
      {role==="Accounting"&&<AccountingView projects={projects} customers={customers} staff={staff} onOpen={setProjectModal} onSave={saveProject}/>}
      {role==="Tasks"&&<TasksView projects={projects} customers={customers} staff={staff} onSave={saveProjectNoClose}/>}
      {role==="Staff"&&<StaffView staff={staff} projects={projects} onEdit={s=>setStaffModal(s)} onNew={()=>setStaffModal(mkStaff({id:null}))}/>}
      {role==="Search"&&<SearchView customers={customers} projects={projects} staff={staff} onOpenProject={setProjectModal} onSelectCustomer={c=>{setSelectedCustomer(c);setRole("Customers");}}/>}
    </div>
    {projectModal&&<ProjectModal project={projectModal} customer={getCust(projectModal)||customers[0]||{}} catalog={pool} staff={staff} onClose={()=>setProjectModal(null)} onSave={saveProject} onDel={delProject}/>}
    {customerModal&&<CustomerModal customer={customerModal} staff={staff} onClose={()=>setCustomerModal(null)} onSave={saveCustomer} onDel={delCustomer}/>}
    {staffModal&&<StaffModal member={staffModal} onClose={()=>setStaffModal(null)} onSave={saveStaff} onDel={delStaff}/>}
    {zohoModal&&<ZohoImportModal onImport={handleZohoImport} onClose={()=>setZohoModal(null)}/>}
  </div>;
}
