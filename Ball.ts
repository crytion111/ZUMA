import {Util} from "./Util";
import Zuma from "../zuma-logic";
import {izx} from "../../framework/izx";


const {ccclass, property} = cc._decorator;

export enum BallType{

    Red,
    Yellow,
    Green,
    Blue,
    Purple
}

@ccclass
export default class Ball extends cc.Component {

    @property(cc.Sprite)
    sprPic1:cc.Sprite = null;
    @property(cc.Sprite)
    sprPic2:cc.Sprite = null;


    // 球能不能滚动
    bCanBallRunRolling:boolean = true;

    lastPos:cc.Vec3 = cc.v3(0, 0);

    // 这个球运行到了轨迹中的哪一点, 如果停下后还要继续走, 就得从这个轨迹点继续走
    _nBallRunedActionIndex:number = 0;

    strBallTypeArr:string[] = ["红", "黄", "绿", "蓝", "紫"]
    ballType:BallType = null;

    // 每个球的唯一标记码
    nBallTokenNum:number = -1;

    nBallRollingSpeed : number = 1;

    //碰撞半径是64像素
    nCollisionRadius:number = 64;

    bBallCanRunPath:boolean = false;

    nMoveBackSpeed:number = 1;//往回走的加速度
    bCanBallMoveBack:boolean = false;

    // 如果是重置了坐标,那么可能就不用那么激进的设置球的转动
    bBallResetPosReverse:boolean = false;

    set nBallRunedActionIndex(index)
    {
        if(index == null)
        {
            cc.error("怎么把index设置成nul的?????????????")
        }
        this._nBallRunedActionIndex = index;
    }

    get nBallRunedActionIndex()
    {
        return this._nBallRunedActionIndex;
    }


    onLoad()
    {
        this.bBallCanRunPath = false;
        this.bBallResetPosReverse = false;
    }

    start ()
    {

    }

    getBallRunningPathIndex():number
    {
        return this.nBallRunedActionIndex;
    }
    getBallTypeString()
    {
        return this.strBallTypeArr[this.ballType];
    }

    initWithBallType(ballType:BallType)
    {
        Zuma.getInstance().gameScene.nBallTokenNum++;
        this.nBallTokenNum = Zuma.getInstance().gameScene.nBallTokenNum;

        this.ballType = ballType;
        let texURL = 'Images/ball/ball_redbg'
        switch (ballType)
        {
            case BallType.Blue:
                texURL = 'Images/ball/ball_bluebg'
                break;
            case BallType.Green:
                texURL = 'Images/ball/ball_greenbg'
                break;
            case BallType.Purple:
                texURL = 'Images/ball/ball_purplebg'
                break;
            case BallType.Red:
                texURL = 'Images/ball/ball_redbg'
                break;
            case BallType.Yellow:
                texURL = 'Images/ball/ball_yellowbg'
                break;
            default:
                break;
        }
        let spriteFrame = Util.loadPic(texURL)
        this.sprPic1.spriteFrame = spriteFrame
        this.sprPic2.spriteFrame = spriteFrame

        this.sprPic1.node.x = 288;
        this.sprPic2.node.x = 32;
    }

    setBallActList(index)
    {
        // 使用每帧设置位置点,就可以很方便的算出这个球的上一个位置和下一个位置
        this.nBallRunedActionIndex = index;
        this.node.position = Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[0];
        this.node.active = true
        this.node.opacity = 0;
        this.node.scale = 0.3;
        cc.tween(this.node)
            .parallel(
                cc.tween(this.node).to(0.1, {opacity:255}),
                cc.tween(this.node).to(0.1, {scale:1}),
            ).start();

        this.bBallCanRunPath = true;
        this.setCanRolling(true);
    }

    insertBallSetAction(index)
    {
        // 使用每帧设置位置点,就可以很方便的算出这个球的上一个位置和下一个位置
        this.nBallRunedActionIndex = index;
        this.bBallCanRunPath = true;
        this.setCanRolling(true);
    }

    resetBallPosIndex(index, bReverse = false)
    {
        this.bBallResetPosReverse = bReverse;

        this.nBallRunedActionIndex = index;
        this.bBallCanRunPath = true;
        this.setCanRolling(true);
        this.runBallPathPoint();
    }

    // 这个球的上一个球应该在什么位置, 用于插入末尾的情况, 返回lastPosIndex,剩下的别的球自己能算出来
    // 有可能返回null, 返回null就需要插入下一个位置,因为肯定是打到发球点了
    getBallLastPosIndex()
    {
        let lastPosIndex:number = 0;
        let posNow = this.node.position;
        for (let i = this.nBallRunedActionIndex - 1; i >= 0; i--)
        {
            let posLastTemp = Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[i];
            if(posLastTemp)
            {
                let fDistans = (posLastTemp.sub(posNow)).mag()
                // 找到离本球一个直径的点
                if(fDistans >= this.nCollisionRadius)
                {
                    lastPosIndex = i;
                    break;
                }
            }
        }

        return lastPosIndex;
    }

    //与上面函数getBallLastPosIndex()同理
    // 有可能返回null, 因为打到终点了,需要结束游戏
    getBallNextPosIndex()
    {
        let nextPosIndex:number = null;
        let posNow = this.node.position;
        for (let i = this.nBallRunedActionIndex + 1; i < Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr.length; i++)
        {
            let posLastTemp = Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[i];
            if(posLastTemp)
            {
                let fDistans = (posLastTemp.sub(posNow)).mag()
                // 找到离本球一个直径的点
                if(fDistans >= this.nCollisionRadius)
                {
                    nextPosIndex = i;
                    break;
                }
            }
        }

        return nextPosIndex;
    }


    runToNextBallPos()
    {
        let posIndex = this.getBallNextPosIndex();
        if(!posIndex)
        {
            izx.dispatchEvent("ball_run_over");
        }
        else
        {
            let posLastTemp = Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[posIndex];
            if(posLastTemp)
            {
                cc.tween(this.node)
                    .to(0.2, {position : posLastTemp})
                    .call(()=>
                    {
                        this.nBallRunedActionIndex = posIndex;
                    })
                    .start();
            }
            else
            {
                cc.error("!!!!!!!!!!!!!!!!!!bug!!!!!!!!!!!!!!!!!!!!!!! + 往下一步走时计算错误!!!!!" + posIndex)
            }
        }
    }



    setCanRolling(bCan)
    {
        this.bCanBallRunRolling = bCan;
    }

    update(dt: number)
    {
        if (this.countBallAngel())
        {
            this.ballRun();
        }

        if(this.bCanBallMoveBack)
        {
            this.nBallRunedActionIndex -= (Zuma.getInstance().gameScene.nBallRunIndexSpeed + this.nMoveBackSpeed);
            this.nMoveBackSpeed = Math.ceil(this.nMoveBackSpeed * 1.1);
            this.runBallPathPoint();
        }
    }


    //类似火车头的机制,让最前面的球自己动,别的球都是根据上一个球的位置来设置位置,方便管理
    selfControlMove()
    {
        if(this.bBallCanRunPath)
        {
            this.nBallRunedActionIndex += Zuma.getInstance().gameScene.nBallRunIndexSpeed;
            this.runBallPathPoint();
        }
    }


    selfControlMoveBack(bCanMoveBack)
    {
        this.bCanBallMoveBack = bCanMoveBack;
        if(!bCanMoveBack)
        {
            this.nMoveBackSpeed = 1;
        }
    }

    runBallPathPoint()
    {
        if(Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[this.nBallRunedActionIndex])
        {
            this.node.position = Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[this.nBallRunedActionIndex];
        }
        // 到头了
        else
        {
            cc.error("这个球的下一个位置是==>" + this.nBallRunedActionIndex+" TokenNum是 " + this.nBallTokenNum);
            izx.dispatchEvent("ball_run_over");
        }
    }


    //计算球的角度
    countBallAngel():boolean
    {
        let curPos = this.node.position
        let deX = curPos.x - this.lastPos.x
        let deY = curPos.y - this.lastPos.y
        //停下了,就不换角度
        if(deX == 0 && deY == 0)
        {
            this.nBallRollingSpeed = 0;
            return false;
        }

        this.nBallRollingSpeed = Math.sqrt(Math.pow(deX,2) + Math.pow(deY,2)) * 1.4;
        this.nBallRollingSpeed = this.nBallRollingSpeed > 3 ? 3 : this.nBallRollingSpeed;
        this.nBallRollingSpeed = this.nBallRollingSpeed < -3 ? -3 : this.nBallRollingSpeed;


        let result = Math.atan2(deY, deX) / (Math.PI / 180);

        this.node.angle = result;

        this.lastPos = curPos;
        return  true;
    }


    //用遮罩来模拟球滚动
    ballRun()
    {
        // 不能滚动时,就不要运行
        if(!this.bCanBallRunRolling)
        {
            return;
        }
        this.sprPic1.node.x += this.nBallRollingSpeed;
        this.sprPic2.node.x += this.nBallRollingSpeed;
        if (this.sprPic1.node.x >= 288)
        {
            this.sprPic1.node.x = this.sprPic2.node.x - 256;
        }
        if (this.sprPic2.node.x >= 288)
        {
            this.sprPic2.node.x = this.sprPic1.node.x - 256;
        }
    }

}
