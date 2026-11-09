export type StudioStep=1|2|3|4;
export function canVisitStep(step:StudioStep,hasMelody:boolean,hasWork:boolean,canPractice=false){
 return step===1||step===2&&hasMelody||step===3&&hasWork||step===4&&canPractice;
}
export function restoreStudioStep(saved:unknown,hasMelody:boolean,work?:{phase:string}|null,canPractice=false):StudioStep{
 if(work&&saved===4)return canPractice?4:3;
 if(work&&(!['complete','error'].includes(work.phase)||saved===3))return 3;
 return saved===2&&hasMelody?2:1;
}
