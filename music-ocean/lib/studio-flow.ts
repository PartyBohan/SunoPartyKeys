export type StudioStep=1|2|3;
export function canVisitStep(step:StudioStep,hasMelody:boolean,hasWork:boolean){
 return step===1||step===2&&hasMelody||step===3&&hasWork;
}
export function restoreStudioStep(saved:unknown,hasMelody:boolean,work?:{phase:string}|null):StudioStep{
 if(work&&(!['complete','error'].includes(work.phase)||saved===3))return 3;
 return saved===2&&hasMelody?2:1;
}
