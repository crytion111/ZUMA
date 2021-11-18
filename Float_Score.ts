
// 游戏内得分的漂浮数字



const {ccclass, property} = cc._decorator;

@ccclass
export default class Float_Score extends cc.Component {

    @property(cc.Label)
    labelScoreType:cc.Label = null;

    @property(cc.Label)
    labelScore: cc.Label = null;


    onLoad ()
    {
        // this.labelScoreType.string = "";
        // this.labelScore.string = "";
    }

    /**
     * @param nScore    分数
     * @param type      连锁还是连击,还是别的类型
     * @param typeNum   连锁数 连击数
     * @constructor
     */
    ShowFloatScore(nScore, type, typeNum, callFunc)
    {
        this.labelScore.string = "/" + nScore;
        if(typeNum > 0)
        {
            this.labelScoreType.node.active = true
            this.labelScoreType.string = type + "x" + typeNum;
        }
        else
        {
            this.labelScoreType.node.active = false
        }

        cc.tween(this.node)
         .by(0.2, {position: cc.v3(0, 100)})
            .delay(1)
            .to(0.1, {opacity : 0})
            .call(()=>
            {
                if(callFunc)
                {
                    callFunc();
                }
                this.node.opacity = 255;
            }).start();
    }

}
