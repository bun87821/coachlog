export type LocalSet={reps:string;weight:string;unit:"kg"|"lb"};
export type LocalExercise={name:string;sets:LocalSet[]};
export type LocalSession={id:string;date:string;notes:string;exercises:LocalExercise[]};
export type LocalMetric={id:string;date:string;weight:string;bodyFat:string;muscle:string};
export type LocalStudent={id:string;name:string;email:string;phone:string;notes:string;metrics:LocalMetric[];sessions:LocalSession[]};
export type LocalBooking={id:string;studentId:string;date:string;time:string;duration:number;notes:string};
export type LocalCoachData={students:LocalStudent[];bookings:LocalBooking[];exerciseNames:string[]};
export const emptyLocalData:LocalCoachData={students:[],bookings:[],exerciseNames:[]};
const key="coachlog-local-v1";
export function loadLocalData():LocalCoachData{try{return JSON.parse(localStorage.getItem(key)||"") as LocalCoachData}catch{return structuredClone(emptyLocalData)}}
export function saveLocalData(data:LocalCoachData){localStorage.setItem(key,JSON.stringify(data))}
export const uid=()=>crypto.randomUUID();
