export type LocalSet={reps:string;weight:string;unit:"kg"|"lb"};
export type LocalExercise={name:string;sets:LocalSet[]};
export type LocalSession={id:string;date:string;notes:string;exercises:LocalExercise[]};
export type LocalMetric={id:string;date:string;weight:string;bodyFat:string;muscle:string};
export type LocalStudent={id:string;name:string;email:string;phone:string;notes:string;metrics:LocalMetric[];sessions:LocalSession[]};
export type LocalBooking={id:string;studentId:string;date:string;time:string;duration:number;notes:string};
export type LocalPeriod={start:string;end:string};
export type LocalCalendarSettings={view:"month"|"week"|"day";duration:number;periods:Record<string,LocalPeriod[]>};
export type LocalCoachData={students:LocalStudent[];bookings:LocalBooking[];exerciseNames:string[];calendarSettings:LocalCalendarSettings};
export const defaultLocalCalendarSettings:LocalCalendarSettings={view:"month",duration:60,periods:{"0":[],"1":[{start:"07:00",end:"21:00"}],"2":[{start:"07:00",end:"21:00"}],"3":[{start:"07:00",end:"21:00"}],"4":[{start:"07:00",end:"21:00"}],"5":[{start:"07:00",end:"21:00"}],"6":[]}};
export const emptyLocalData:LocalCoachData={students:[],bookings:[],exerciseNames:[],calendarSettings:defaultLocalCalendarSettings};
const key="coachlog-local-v1";
export function loadLocalData():LocalCoachData{try{const saved=JSON.parse(localStorage.getItem(key)||"") as Partial<LocalCoachData>;return{...structuredClone(emptyLocalData),...saved,calendarSettings:{...structuredClone(defaultLocalCalendarSettings),...(saved.calendarSettings||{})}}}catch{return structuredClone(emptyLocalData)}}
export function saveLocalData(data:LocalCoachData){localStorage.setItem(key,JSON.stringify(data))}
export const uid=()=>crypto.randomUUID();
