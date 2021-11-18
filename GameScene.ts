import BaseUI from "../../framework/base/baseUI";
import {izx} from "../../framework/izx";
import {AudioMgr} from "../../framework/mgr/audioMgr";
import {AudioUtil} from "../AudioUtil";
import EventTrack, {TrackNames} from "../../framework/EventTrack";
import Zuma from "../zuma-logic";
import GateMgr from "../../framework/net/gateMgr";
import UserData from "./UserData";
import Level_Ctrl from "./Level_Ctrl";
import Ball, {BallType} from "./Ball";
import Float_Score from "./Float_Score";
import {Util} from "./Util";

export const enum GameEnv {
    Env_Newbie,
    Env_NewbieConfig,
    Env_Config,
    Env_Random
}

const {ccclass, property} = cc._decorator;

@ccclass
export default class GameScene extends BaseUI {

    nDebugBallAllTypeNum = 3; //一共生成几类球 1 - 5


    //关卡的父节点
    @property(cc.Node)
    nodePathRoot: cc.Node = null;
    @property(cc.Node)
    nodeBeginPoint: cc.Node = null;
    @property(cc.Node)
    nodeEndPoint: cc.Node = null;


    //青蛙父节点, 用来计算角度
    @property(cc.Node)
    nodeFrogRoot: cc.Node = null;
    @property(cc.Node)
    nodeNextFrogBall: cc.Node = null;
    //青蛙节点,用来转角度
    @property(cc.Node)
    nodeFrog: cc.Node = null;
    // 青蛙的嘴,需要生成球加到这里
    @property(cc.Node)
    nodeFrogMask: cc.Node = null;


    @property(cc.Label)
    labelTopScore:cc.Label = null;
    @property(cc.Label)
    labelTopTime:cc.Label = null;
    @property(cc.Label)
    labelTopScorePercent:cc.Label = null;

    // 暂停和炸弹
    @property(cc.Button)
    btnPauseGame:cc.Button = null;
    @property(cc.Button)
    btnBoomBall:cc.Button = null;
    @property(cc.Label)
    labelBoomCount:cc.Label = null;
    nHaveBoomCount:number = 0;

    //游戏开局结束的提示
    //目标分 1200
    @property(cc.Node)
    nodeTargetScore:cc.Node = null
    @property(cc.Label)
    labelTargetScore:cc.Label = null;
    //目标完成
    @property(cc.Node)
    nodeTargetScoreComplete:cc.Node = null
    //时间结束
    @property(cc.Node)
    nodeTimeOverTips:cc.Node = null;
    //游戏结束
    @property(cc.Node)
    nodeGameOverTips:cc.Node = null;

    //青蛙嘴里的子弹球
    nodeFrogBall: cc.Node = null;
    // 球
    @property(cc.Prefab)
    prefabBallNode: cc.Prefab = null;//肯定是频繁的显示和消失, 使用对象池

    //肯定是频繁的显示和消失, 使用对象池
    @property(cc.Prefab)
    prefabFloatScore: cc.Prefab = null; //漂浮的得分

    nCurrentFrogBallType: BallType = null;  //当前嘴里的
    nNextFrogBallType: BallType = null;     //下一个即将出来的



    bTimeStart:boolean = false;
    nAllTime: number = 3*60;
    nGameTime: number = 0

    // 游戏结束
    bGameOver: boolean = false;

    // 给球设置对象池
    listLivingBallPool: cc.Node[] = []; //场内的球数据, 最前面的球下标是0
    listFreeBallPool: cc.Node[] = [];   //等待调用的球数据,如果没有就需要新建加入进去

    // 漂浮的得分 对象池
    listLivingScorePool: cc.Node[] = []; //正在显示的分数节点
    listFreeScorePool: cc.Node[] = [];   //等待调用的分数节点


    level_ctrl: Level_Ctrl = null;
    bLevelConfigLoaded: boolean = false;


    //每个球的唯一标记,用来判断球是不是目标球
    nBallTokenNum: number = 1;

    nTouchStartBallNum: number = -1; //点击屏幕时的球和放开屏幕时的球要一样才能发射,不然会误触

    // 不是每帧都要检测碰撞
    bOpenCollisionCheck: boolean = false;

    //暂停所有球的位移和创建
    bUpdateCreateBallList: boolean = false;

    //是不是在检测碰撞中,是的话就不用在检测
    bRunningCollisionCheck: boolean = false;

    // 所有球的移动速度
    nBallRunIndexSpeed: number = -99
    // 默认一帧移动2次
    nDefaultIndexSpeed: number = 2;

    // 每次整个链条只有一个球是在主动滚动的,别的球都是跟随它
    nodeBallHead: cc.Node = null;

    // 一个链条可能会断成很多段, 需要记录下所有断掉的地方,当nodeBallHead移动到这里时,需要链接上
    // 存的是断裂处,靠近终点的球
    arrBrokenList: cc.Node[] = [];

    bNextBallWillBeHead: boolean = false;// 一次消除直接消到了起点,那么下一个出来的球应该是球组的头

    // 每次断开并且可以继续消除时, 必然有两个球,判断这两个球后续是否碰撞
    ballNearbyStart: cc.Node = null; //临近起点的那个
    ballNearbyEnd: cc.Node = null;   //临近终点的那个

    bGamePauseByButton:boolean = false;


    //分数逻辑
    /**
     * 普通消去：
     每消除1个珠子得10分

     连锁得分    游戏得分
     2连锁    当次珠子分数X2
     3连锁    当次珠子分数X3
     4连锁    当次珠子分数X4
     5连锁    当次珠子分数X5
     6连锁    当次珠子分数X6
     7连锁    当次珠子分数X7
     8连锁    当次珠子分数X8
     9连锁    当次珠子分数X9
     10连锁    当次珠子分数X10

     连击得分：
     根据连击数量分段进行加分，1-3连击0、4连击40分、5连击50分，依次类推

     穿越得分：
     当消去动作产生时，消失的珠子会让珠串产生短暂的断层，如果玩家从断层中射出珠子又构成了消去动作，
     消去珠子的分数X2，如果穿越2层，则分数X3，依次类推

     时间奖励：
     时间总秒数（精确到小数点1位，毫秒向下取整）*10*消除百分比（最大为100%）
     * */


    // 发射子弹导致连击次数
    nFrogBallComboNum: number = 0;
    nMaxFrogBallComboNum: number = 0; //全局最高连击次数

    // 回退消除导致的连锁次数
    nChainComboNum: number = 0;
    nMaxChainComboNum: number = 0; //全局最高连锁次数

    //穿越空当造成消除
    nThroughNum:number = 0;     // 穿过一个空当就加一
    nMaxThroughNum:number = 0;  //全局最高穿越次数

    // 每个球底分10分
    nPerBallScore: number = 10;

    //本局游戏的操作分
    nAllActionScore:number = 0;

    //本局游戏的目标得分
    nTargetActionScore:number = 0;


    offAllEvent()
    {
        izx.offByTag(this)
    }

    onLoad()
    {
        this.nGameTime = this.nAllTime;
        this.formatTime()
        Zuma.getInstance().gameScene = this
        // 21点不需要多点触摸
        cc.macro.ENABLE_MULTI_TOUCH = false;

        EventTrack.add(TrackNames.GAME_SCENE)
        this.offAllEvent()

        UserData.pid = GateMgr.playerA.id

        AudioMgr.init("zuma")
        AudioUtil.stopBackground()
        AudioUtil.playMusic("musiczuma")

        izx.on("level_config_load_finish", this.setBallActionList, this)
        izx.on("ball_run_over", this.gameOver, this)


        this.node.on(cc.Node.EventType.TOUCH_START, this.onTouchStart, this)
        this.node.on(cc.Node.EventType.TOUCH_MOVE, this.onTouchMove, this)
        this.node.on(cc.Node.EventType.TOUCH_END, this.onTouchEnd, this)
        this.node.on(cc.Node.EventType.TOUCH_CANCEL, this.onTouchEnd, this)

        this.btnPauseGame.node.on("click", this.onClickPauseGame, this)
        this.btnBoomBall.node.on("click", this.onClickBoomBall, this)

        this.bTimeStart = false;
        this.bGameOver = false;
        this.bOpenCollisionCheck = false;
        this.bRunningCollisionCheck = false;
        this.bGamePauseByButton = false;
        this.nBallRunIndexSpeed = this.nDefaultIndexSpeed;
        this.nodeNextFrogBall.active = false;

        this.nodeTargetScore.active = false;
        this.nodeTargetScoreComplete.active = false;
        this.nodeTimeOverTips.active = false;
        this.nodeGameOverTips.active = false;

        this.nFrogBallComboNum = 0;
        this.nMaxFrogBallComboNum = 0;
        this.nChainComboNum = 0;
        this.nMaxChainComboNum = 0;

        this.labelBoomCount.string = this.nHaveBoomCount+"";
        //这里就可以控制加载什么关卡的配置
        this.level_ctrl = new Level_Ctrl();
        this.level_ctrl.start(1);
    }

    timeOver()
    {
        this.bGameOver = true;
        cc.log("时间结束了==========>");

        this.ShowOverAnimation(this.nodeTimeOverTips)
    }

    gameOver()
    {
        this.bGameOver = true;
        cc.log("球进了终点, 游戏结束==========>");

        this.ShowOverAnimation(this.nodeGameOverTips)
    }

    gameComplete()
    {
        this.bGameOver = true;
        cc.log("分数达标==========>");

        this.ShowOverAnimation(this.nodeTargetScoreComplete)
    }

    ShowOverAnimation(nodeTips :cc.Node)
    {
        this.listLivingBallPool.forEach((ball, index) =>
        {
            ball.getComponent(Ball).selfControlMoveBack(false);
        })
        this.pauseBallCreateAndRolling();
        this.unschedule(this.timeCallback);

        nodeTips.active = true;
        cc.tween(nodeTips)
            .to(0.2, {scale: 1.5})
            .to(0.1, {scale:1})
            .delay(2)
            .parallel(
                cc.tween(nodeTips).by(0.2, {y: 200}),
                cc.tween(nodeTips).to(0.2, {opacity: 0}),
            )
            .call(()=>
            {
                nodeTips.active = false;
                this.BoomAllPoolNode()

                let fPercent = this.nAllActionScore / this.nTargetActionScore
                fPercent = fPercent > 1 ? 1:fPercent;
                let timeScore = Math.floor(this.nGameTime * 10 * fPercent)
                let nAllScore = this.nAllActionScore + timeScore

                let nodeScore = this.createAFloatScoreNode();
                nodeScore.active = true;
                nodeScore.getComponent(Float_Score).ShowFloatScore(timeScore, "时间分", 1, () =>
                {
                    this.freeAScoreNode(nodeScore);
                    this.runScoreLabelToScore(nAllScore+"");

                    this.destroyedAllPoolNode()
                    izx.pushDialog("zuma","Prefab/GameOverUI",null,{mask:true})
                })
                nodeScore.setScale(2);
                nodeScore.position = cc.v3(0,  200);
                this.node.addChild(nodeScore, 99);
            })
            .start();

    }

    startGame()
    {
        UserData.load()
        //BUG  如果对方没结算, 这个games会一直停留在原来的数字,不管你玩了多少局
        // 所以不能直接用iGaoShouApi.GetSelf().games,应该本地做个计数, 与这个数对比

        let nServerGames = iGaoShouApi.GetSelf().games //获取玩家服务器结算了多少局
        let nLocalGames = UserData.gameCount; //获取玩家本地点击开始游戏多少次
        let todayN = Math.max(nServerGames, nLocalGames) //取最大值并加一赋给本地的
        izx.log("获取玩家一共玩了多少局== ", todayN, " 服务器=" + nServerGames, " 本地算的= " + nLocalGames)
        UserData.gameCount = todayN + 1
        UserData.save();


        this.bUpdateCreateBallList = true;

        this.setHeadBall(null);
        this.quickSendSomeBall(() =>
        {
            this.reloadBallToFrog();
        })

    }

    afterSendCall: Function = null;

    // 开局先创造一些球送出来, 送球结束后才能发炮
    quickSendSomeBall(callBack: Function)
    {
        this.nBallRunIndexSpeed = 60;
        this.afterSendCall = callBack;
        this.schedule(this.slowBallSpeed, 1 / 60)
    }

    slowBallSpeed()
    {
        this.nBallRunIndexSpeed -= 2;
        if (this.nBallRunIndexSpeed <= this.nDefaultIndexSpeed)
        {
            this.nBallRunIndexSpeed = this.nDefaultIndexSpeed;
            this.unschedule(this.slowBallSpeed)
            if (this.afterSendCall)
            {
                this.afterSendCall();
                this.afterSendCall = null;
            }
        }
    }

    createOneListBall(nIndex = 0): cc.Node
    {
        let num = this.getIntRandom(0, this.nDebugBallAllTypeNum - 1);
        let ball = this.createABallByBallType(num);
        ball.active = false;
        this.nodePathRoot.addChild(ball)
        this.level_ctrl.setBallActionList(ball.getComponent(Ball), nIndex);

        return ball;
    }


    onTouchStart(touch: cc.Touch)
    {
        if (this.bGameOver || this.bGamePauseByButton)
        {
            return;
        }
        let worldPos = touch.getLocation()
        this.node.convertToWorldSpaceAR(worldPos);
        this.setFrogAngelByTouchPos(worldPos);

        if (this.nodeFrogBall)
        {
            this.nTouchStartBallNum = this.nodeFrogBall.getComponent(Ball).nBallTokenNum;
        }
    }

    onTouchMove(touch: cc.Touch)
    {
        if (this.bGameOver || this.bGamePauseByButton)
        {
            return;
        }
        let worldPos = touch.getLocation()
        this.node.convertToWorldSpaceAR(worldPos);
        this.setFrogAngelByTouchPos(worldPos);
    }

    onTouchEnd(touch: cc.Touch)
    {
        if (this.bGameOver || this.bGamePauseByButton)
        {
            return;
        }
        let worldPos = touch.getLocation()
        this.node.convertToWorldSpaceAR(worldPos);
        let frogAngle = this.setFrogAngelByTouchPos(worldPos);

        if (this.nodeFrogBall)
        {
            if (this.nodeFrogBall.getComponent(Ball).nBallTokenNum == this.nTouchStartBallNum)
            {
                this.shootBall(frogAngle)
            }
        }
        this.nTouchStartBallNum = null;
    }

    onClickPauseGame()
    {
        this.bGamePauseByButton = !this.bGamePauseByButton;

        if(this.bGamePauseByButton)
        {
            izx.pushDialog("zuma","Prefab/SettingUI",null,{mask:true})

            this.pauseBallCreateAndRolling();
            this.unschedule(this.timeCallback);
        }
        else
        {
            this.continueBallCreateAndRolling();
            this.timeCallback(0);
            this.startClockTime();
        }
    }

    onClickBoomBall()
    {

    }

    //给青蛙重新装弹
    reloadBallToFrog()
    {
        this.bOpenCollisionCheck = false;

        this.nodeFrogBall = cc.instantiate(this.prefabBallNode);
        this.nodeFrogMask.addChild(this.nodeFrogBall);

        if(this.nNextFrogBallType === null)
        {
            this.nCurrentFrogBallType = this.getIntRandom(0, this.nDebugBallAllTypeNum - 1);
        }
        else
        {
            this.nCurrentFrogBallType = this.nNextFrogBallType;
        }

        this.nNextFrogBallType = this.getIntRandom(0, this.nDebugBallAllTypeNum - 1);
        let texURL = 'Images/ball/ball_redbg'
        switch (this.nNextFrogBallType)
        {
            case BallType.Blue:
                texURL = 'Images/ball/ball_blue'
                break;
            case BallType.Green:
                texURL = 'Images/ball/ball_green'
                break;
            case BallType.Purple:
                texURL = 'Images/ball/ball_purple'
                break;
            case BallType.Red:
                texURL = 'Images/ball/ball_red'
                break;
            case BallType.Yellow:
                texURL = 'Images/ball/ball_yellow'
                break;
            default:
                break;
        }
        this.nodeNextFrogBall.active = true;
        this.nodeNextFrogBall.getComponent(cc.Sprite).spriteFrame = Util.loadPic(texURL);
        this.nodeFrogBall.getComponent(Ball).initWithBallType(this.nCurrentFrogBallType);

        this.nodeFrogBall.position = cc.v3(0, 60);

        cc.tween(this.nodeFrogBall)
            .to(0.2, {position: cc.v3(0, 15)})
            .start();
    }

    shootBall(frogAngle: number)
    {
        let nJiaoDu = (180 - frogAngle - 90) * Math.PI / 180;
        let nShootRag = 2000;
        let nDstX = Math.cos(nJiaoDu) * nShootRag;
        let nDstY = -Math.sin(nJiaoDu) * nShootRag;

        // 这时可以发射
        if (this.nodeFrogBall && this.nodeFrogBall.parent == this.nodeFrogMask)
        {
            this.nodeFrogBall.stopAllActions();
            this.nodeFrogBall.position = cc.v3(0, 15);
            let originalPos1 = this.nodeFrogBall.convertToWorldSpaceAR(cc.v3(0, 0));
            let originalPos2 = this.nodePathRoot.convertToNodeSpaceAR(originalPos1);

            this.nodeFrogBall.parent = this.nodePathRoot;
            this.nodeFrogBall.position = originalPos2
            this.nodeFrogBall.runAction(cc.moveTo(1, cc.v2(nDstX, nDstY)));
            this.nodeFrogBall.getComponent(Ball).setCanRolling(false);

            if(!this.bTimeStart)
            {
                this.bTimeStart = true;
                this.startClockTime();
            }
        }

        this.bOpenCollisionCheck = true;
    }


    //传入世界坐标系
    setFrogAngelByTouchPos(posWorld): number
    {
        let frogPos = this.nodeFrogRoot.convertToNodeSpaceAR(posWorld);
        let result = Math.atan2(frogPos.y, frogPos.x) / (Math.PI / 180);
        this.nodeFrog.angle = result + 90;

        return this.nodeFrog.angle
    }

    //关卡加载成功,后续的球就可以创建了
    setBallActionList()
    {
        this.nTargetActionScore = 5000;
        this.nodeTargetScore.active = true;
        this.labelTargetScore.string = this.nTargetActionScore + ""

        cc.tween(this.nodeTargetScore)
            .to(0.2, {scale: 1.2})
            .to(0.1, {scale: 1})
            .delay(2)
            .parallel(
                cc.tween(this.nodeTargetScore).by(0.2, {y: 200}),
                cc.tween(this.nodeTargetScore).to(0.2, {opacity: 0}),
            )
            .call(() =>
            {
                this.nodeTargetScore.active = false;
            })
            .start();

        //   return;
        this.bLevelConfigLoaded = true;
        this.startGame();
    }


    update(dt: number)
    {
        if (this.bGameOver)
        {
            return;
        }
        if (this.bUpdateCreateBallList)
        {
            let nLength = this.listLivingBallPool.length;

            //  已经没球了, 或者下一个球应该是球组的头了,直接创建
            if (nLength == 0 || this.bNextBallWillBeHead)
            {
                let headBall = this.createOneListBall();
                // 球组的头机制, 让0号球自主动,别的球都是跟随它
                this.setHeadBall(headBall);
                if (this.bNextBallWillBeHead)
                {
                    this.bNextBallWillBeHead = false;
                }
            }
            // 普通情况, 根据前面的位置来确定下一个球的创建条件
            else
            {
                let lastBallNode = this.listLivingBallPool[nLength - 1];
                let lastBallPos = lastBallNode.position;
                let beginPos = this.level_ctrl.posLevelBegin;
                let nDist = lastBallPos.sub(beginPos).mag();
                let nCollRadius = lastBallNode.getComponent(Ball).nCollisionRadius;
                if (nDist >= nCollRadius)
                {
                    let nLastIndex = lastBallNode.getComponent(Ball).getBallLastPosIndex();
                    this.createOneListBall(nLastIndex);
                }
            }

            if (this.nodeBallHead)
            {
                this.nodeBallHead.getComponent(Ball).selfControlMove();
                this.fixAllListBallPosition();
            }
        }
        this.checkHeadBallAndBrokenPoint();


        if (this.nodeFrogBall)
        {
            let curWorldPos = this.nodeFrogBall.convertToWorldSpaceAR(cc.v3(0, 0));
            // 这个球超出边界了
            if (curWorldPos.x < -100
                || curWorldPos.y < -100
                || curWorldPos.x > cc.winSize.width + 100
                || curWorldPos.y > cc.winSize.height + 100)
            {
                // 打了但是这个球超出边界了,连击数清空
                this.nFrogBallComboNum = 0;

                this.freeABallNode(this.nodeFrogBall);
                this.nodeFrogBall = null;
                cc.tween(this.node).delay(0.2).call(() =>
                {
                    this.reloadBallToFrog();
                }).start();
                return;
            }
        }
        if (this.bOpenCollisionCheck)
        {
            this.checkBallsCollision();
        }
    }

    //检测碰撞, 既要检测青蛙的球,也要检测链条内自己的球
    checkBallsCollision()
    {
        if (this.nodeFrogBall)
        {
            if (this.bRunningCollisionCheck || this.bGameOver)
            {
                return;
            }
            let nRNum = this.nodeFrogBall.getComponent(Ball).nCollisionRadius;
            let posFrogWorld = this.nodeFrogBall.position;

            this.listLivingBallPool.forEach((ball, index) =>
            {
                if (this.bGameOver)
                {
                    return;
                }
                let posBallWorld = ball.position;

                let newVec = posBallWorld.sub(posFrogWorld)
                let nDistans = newVec.mag();
                if (nDistans <= nRNum)
                {
                    this.bRunningCollisionCheck = true;
                    this.nodeFrogBall.stopAllActions();
                    this.bOpenCollisionCheck = false;
                    this.pauseBallCreateAndRolling();
                    this.insertBallInLivingList(ball, index);
                    return;
                }
            })
        }
    }


    //将球插入链条中
    insertBallInLivingList(collBall: cc.Node, collIndex: number)
    {
        // 碰撞的瞬间清空上次的穿越分数
        this.nThroughNum = 0;
        let nowPosIndex = collBall.getComponent(Ball).getBallRunningPathIndex();
        let lastBallPosIndex = collBall.getComponent(Ball).getBallLastPosIndex();
        let nextBallPosIndex = collBall.getComponent(Ball).getBallNextPosIndex();
        let posArr = this.level_ctrl.ballFramePointArr;


        let posFrogPathRoot = this.nodeFrogBall.position;
        let posBallPathRoot = collBall.position;
        //打到终点了
        if (nextBallPosIndex === null)
        {
            this.gameOver();
            return;
        }


        let bRunToNextPos = false;
        //打到起点了
        if (lastBallPosIndex == 0)
        {
            cc.tween(this.nodeFrogBall)
                .to(0.2, {position: posArr[nextBallPosIndex]})
                .call(() =>
                {
                    this.insertBallOver(collBall, true, nextBallPosIndex);
                }).start();
            bRunToNextPos = true;
        }
        // 判断玩家离哪个点近,就插入哪个点
        else
        {
            let posLast = posArr[lastBallPosIndex]
            let posNext = posArr[nextBallPosIndex]
            let disToLast = posLast.sub(posFrogPathRoot).mag();
            let disToNext = posNext.sub(posFrogPathRoot).mag();
            // 离下一个近
            if (disToLast >= disToNext)
            {
                cc.tween(this.nodeFrogBall)
                    .to(0.2, {position: posNext})
                    .call(() =>
                    {
                        this.insertBallOver(collBall, true, nextBallPosIndex);
                    }).start();
                bRunToNextPos = true;
            }
            // 直接占据碰撞点的球位置
            else
            {
                // 直接占据碰撞点的球位置
                cc.tween(this.nodeFrogBall)
                    .to(0.2, {position: posBallPathRoot})
                    .call(() =>
                    {
                        //            // 直接占据碰撞点的球位置
                        this.insertBallOver(collBall, false, nowPosIndex);
                    }).start();
                bRunToNextPos = false;
            }
        }
        this.inExeInsertBall(collBall, bRunToNextPos);
    }

    inExeInsertBall(collBall, bRunToNextPos)
    {
        if (this.bGameOver)
        {
            return;
        }

        // 碰撞的位置
        let colBallIndex = this.listLivingBallPool.indexOf(collBall);
        let nInsertIndex = 0;
        // 如果青蛙球是塞进下一个的位置
        if (bRunToNextPos)
        {
            nInsertIndex = colBallIndex;
        }
        //塞进上一个
        else
        {
            nInsertIndex = colBallIndex + 1;
        }

        for (let i = nInsertIndex - 1; i >= 0; i--)
        {
            if (this.listLivingBallPool[i])
            {
                this.listLivingBallPool[i].getComponent(Ball).runToNextBallPos();
            }
        }
    }

    insertBallOver(collBall: cc.Node, bRunToNextPos: boolean, pathIndex)
    {
        if (this.bGameOver)
        {
            return;
        }
        // 碰撞的位置
        let colBallIndex = this.listLivingBallPool.indexOf(collBall);
        let nInsertIndex = 0;
        // 如果青蛙球是塞进下一个的位置
        if (bRunToNextPos)
        {
            nInsertIndex = colBallIndex;
            // 打到球组的头
            if (collBall == this.nodeBallHead)
            {
                this.setHeadBall(this.nodeFrogBall);
            }
        }
        //塞进上一个
        else
        {
            nInsertIndex = colBallIndex + 1;

            //塞进断点球的上一个, 需要更新断点球属性了
            let nI = this.arrBrokenList.indexOf(collBall);
            if (nI > -1)
            {
                this.arrBrokenList.splice(nI, 1);
                this.safePushBrokenList(this.nodeFrogBall);
            }
        }
        this.listLivingBallPool.splice(nInsertIndex, 0, this.nodeFrogBall)

        this.resetLivingBallsIndex();

        this.level_ctrl.insertBallToActionList(this.nodeFrogBall.getComponent(Ball), pathIndex);
        this.nodeFrogBall = null;

        this.bRunningCollisionCheck = false;

        // this.DeBugBallList();
        this.checkBallFade(nInsertIndex, true);
        this.reloadBallToFrog();

    }


    /**
     * 检测这次发炮能不能消除
     * @param nInsertIndex 从nInsertIndex来遍历前面和后面
     * @param bInsert      是发射子弹的插入,还是回撤的碰撞
     */
    async checkBallFade(nInsertIndex: number, bInsert)
    {
        if (!this.listLivingBallPool[nInsertIndex])
        {
            cc.log("检测碰撞消除时错了nInsertIndex==> " + nInsertIndex);
            return;
        }
        let insertType = this.listLivingBallPool[nInsertIndex].getComponent(Ball).ballType;
        // 插入球后第一批需要消除的球组, 后面可能会有第二批,第三批
        let arrFirstNeedFadeBalls: cc.Node[] = [this.listLivingBallPool[nInsertIndex]];

        let nSearchLast = nInsertIndex + 1
        let ballFront: cc.Node = null; //靠近起点的球
        while (this.listLivingBallPool[nSearchLast])
        {
            let lastBall = this.listLivingBallPool[nSearchLast]
            if (lastBall.getComponent(Ball).ballType == insertType)
            {
                arrFirstNeedFadeBalls.push(lastBall);
                nSearchLast++;
            }
            else
            {
                ballFront = lastBall;
                break;
            }
        }

        let nSearchNext = nInsertIndex - 1
        let curBrokenBall: cc.Node = null;   //靠近终点的球
        while (this.listLivingBallPool[nSearchNext])
        {
            let nextBall = this.listLivingBallPool[nSearchNext]
            if (nextBall.getComponent(Ball).ballType == insertType)
            {
                arrFirstNeedFadeBalls.push(nextBall);
                nSearchNext--;
            }
            else
            {
                curBrokenBall = nextBall;
                break;
            }
        }

        // 符合消除的条件
        if (arrFirstNeedFadeBalls.length >= 3)
        {
            // 连击数加一
            if (bInsert)
            {
                this.nFrogBallComboNum++;
                if(this.nFrogBallComboNum > this.nMaxFrogBallComboNum)
                {
                    this.nMaxFrogBallComboNum = this.nFrogBallComboNum;
                }
                // todo 如果是发射消除,还需要判断这个球是不是穿越了空白区域
                // todo 可以简化成判断两个线段有没有交点
                this.checkFrogBallIsThrough(nInsertIndex);
            }
            else
            {
                this.nChainComboNum++;  //连锁次数加一
                if(this.nChainComboNum > this.nMaxChainComboNum)
                {
                    this.nMaxChainComboNum = this.nChainComboNum;
                }
            }

            // 直接消除到了起点,那么下一个生成的球才应该是头
            if (nSearchLast == this.listLivingBallPool.length)
            {
                cc.log('本次消除直接消到了起点!!!!!!!!!!!' + nSearchLast)
                this.bNextBallWillBeHead = true;
                // 只是让球继续创建,之前的哪些球不能动,继续不能动
                this.bUpdateCreateBallList = true;
                this.setHeadBall(null);
            }

            //如果这次又打断了一个往后的球,就需要重新设置球组的头
            arrFirstNeedFadeBalls.forEach((ball, index) =>
            {

                for (let i = 0; i < this.arrBrokenList.length; i++)
                {
                    let nBallNum = this.arrBrokenList[i].getComponent(Ball).nBallTokenNum;
                    if (ball.getComponent(Ball).nBallTokenNum == nBallNum)
                    {
                        let headIndex = this.listLivingBallPool.indexOf(ball);

                        // cc.error("这个断掉的地方又被消除了===nBallNum=" + nBallNum + " 下标= " + headIndex);
                        this.arrBrokenList.splice(i, 1);
                        break;
                    }
                }

                //先从living中移开,防止后续的碰撞判断带上这个球
                this.removeFromLiving(ball);
            })

            let isMinIndex = true;
            if (curBrokenBall)
            {
                let nCurIndex = curBrokenBall.getComponent(Ball).nBallRunedActionIndex;
                for (let i = 0; i < this.arrBrokenList.length; i++)
                {
                    let nIndex = this.arrBrokenList[i].getComponent(Ball).nBallRunedActionIndex;
                    if (nCurIndex > nIndex)
                    {
                        isMinIndex = false;
                        break;
                    }
                }
            }
            else
            {
                if (this.nodeBallHead)
                {
                    let headIndex = this.listLivingBallPool.indexOf(this.nodeBallHead);
                    if (headIndex > 0)
                    {
                        isMinIndex = false;
                    }
                }
            }


            // 重新设置球组的头
            if (isMinIndex && !this.bNextBallWillBeHead)
            {
                this.setHeadBall(this.listLivingBallPool[nSearchNext + 1]);
            }

            let bCanRunBack = false;//能不能后撤
            let nSameNum = 0;   //前后想同的球
            //这里已经设置好新的球组的头, 开始递归检测断点前后
            if (curBrokenBall && ballFront && !this.bNextBallWillBeHead)
            {
                this.ballNearbyStart = ballFront;
                this.ballNearbyEnd = curBrokenBall;

                let objCheck = this.checkBrokenBallType(ballFront, curBrokenBall,
                    nSearchNext + 1, nSearchNext);
                // 是不是可以继续碰撞, 因为上面已经消除了,所以这时的last和next是连续的
                bCanRunBack = objCheck.bCanRunBack;
                nSameNum = objCheck.nSameNum;
            }

            // cc.error("记录下断掉的点==>" + nSearchNext , curBrokenBall);
            // if(curBrokenBall)
            // {
            //     let nIndex = this.listLivingBallPool.indexOf(curBrokenBall);
            //     cc.error("curBrokenBall=" + curBrokenBall.getComponent(Ball).getBallTypeString()+" 位置====>+"+nIndex);
            // }

            // 记录下断掉的点, 如果消除到球组的头了,就不用记录
            if (nSearchNext >= 0 && curBrokenBall)
            {
                this.safePushBrokenList(curBrokenBall);
            }


            // 这时才从节点系统中移除并放入free池中
            // 需要等待爆炸运行完毕,才能继续后面的运动
            await this.runBallBoomAction(arrFirstNeedFadeBalls);

            // 不能后退,也要断连锁
            if (!bCanRunBack)
            {
                this.nChainComboNum = 0;
            }
            // 需要等往回走的动画就不让球滚动了
            if (!bCanRunBack && !this.bNextBallWillBeHead)
            {
                this.continueBallCreateAndRolling();
            }
        }
        else if (arrFirstNeedFadeBalls.length < 3)
        {
            // 打中了但是没消除,连击数清空
            if (bInsert)
            {
                this.nFrogBallComboNum = 0;
            }
            this.nChainComboNum = 0;
            this.continueBallCreateAndRolling();
        }
    }

    /**
     *
     * @param nInsertIndex  青蛙子弹的最终落点
     */
    checkFrogBallIsThrough(nInsertIndex)
    {
        // 都没有空当区域, 不要判断穿越算法
        if(this.arrBrokenList.length <= 0)
        {
            return;
        }
        // 全部用世界坐标系判断
        // 青蛙的起止线段
        let posFrogBallEnd = this.listLivingBallPool[nInsertIndex].convertToWorldSpaceAR(cc.v3(0, 0));
        let posFrogBallStart = this.nodeFrog.convertToWorldSpaceAR(cc.v3(0, 0));

        // 遍历所有的空当区域线段, 判断是不是和青蛙线段有交点
        this.arrBrokenList.forEach((ball, index)=>
        {
            let posKongDangEnd = ball.convertToWorldSpaceAR(cc.v3(0, 0));

            let nearBallStartIndex = this.listLivingBallPool.indexOf(ball);
            // 如果发现插入的是断掉的区域还消除了,就不要判断相交,因为肯定相交,但是不符合条件
            if(nInsertIndex == nearBallStartIndex || nearBallStartIndex == nearBallStartIndex + 1)
            {
                return;
            }
            // 这个就是空当区域中,靠近起点的球
            let nearBallStart = this.listLivingBallPool[nearBallStartIndex + 1];
            // 默认是以轨迹起点为起点
            let posKongDangStart = this.nodePathRoot.convertToWorldSpaceAR(
                Zuma.getInstance().gameScene.level_ctrl.ballFramePointArr[0]);

            // 如果上一个球真的存在
            if(nearBallStart)
            {
                posKongDangStart = nearBallStart.convertToWorldSpaceAR(cc.v3(0, 0));
            }




            // 校验这个四个线段的交点
            let intersecPoint = this.getLineIntersection(
                posFrogBallEnd.x, posFrogBallEnd.y,
                posFrogBallStart.x, posFrogBallStart.y,
                posKongDangEnd.x, posKongDangEnd.y,
                posKongDangStart.x,posKongDangStart.y)


            if(intersecPoint)
            {
                cc.error("本次穿越点-=====> posFrogBallEnd=",JSON.stringify(posFrogBallEnd),
                    " posFrogBallStart=",JSON.stringify(posFrogBallStart),
                    " posKongDangEnd=", JSON.stringify(posKongDangEnd),
                    " posKongDangStart=", JSON.stringify(posKongDangStart),
                    "相交与========>"+ JSON.stringify(intersecPoint)
                )


                this.nThroughNum++;
                if(this.nThroughNum > this.nMaxThroughNum)
                {
                    this.nMaxThroughNum = this.nThroughNum;
                }
            }
        })
    }

    //计算两个线段有没有焦点
    getLineIntersection(p0_x, p0_y, p1_x, p1_y, p2_x, p2_y, p3_x, p3_y)
    {
        let s1_x, s1_y, s2_x, s2_y , i_x,  i_y;
        s1_x = p1_x - p0_x;
        s1_y = p1_y - p0_y;
        s2_x = p3_x - p2_x;
        s2_y = p3_y - p2_y;

        let s, t;
        s = (-s1_y * (p0_x - p2_x) + s1_x * (p0_y - p2_y)) / (-s2_x * s1_y + s1_x * s2_y);
        t = (s2_x * (p0_y - p2_y) - s2_y * (p0_x - p2_x)) / (-s2_x * s1_y + s1_x * s2_y);

        if (s >= 0 && s <= 1 && t >= 0 && t <= 1)
        {
            i_x = p0_x + (t * s1_x);
            i_y = p0_y + (t * s1_y);

            return cc.v3(i_x, i_y);
        }
        return null // 无交点
    }


    // 需要等待爆炸运行完毕,才能继续
    async runBallBoomAction(ballArr: cc.Node[])
    {
        cc.log("=======连锁数====> " + this.nChainComboNum + '  连击数====> ' + this.nFrogBallComboNum + " 穿越次数=="+this.nThroughNum);

        // 当连锁==0, 连击>0时,就是青蛙球碰到,算连击分
        // 当连锁>0时,算连锁分
        ballArr.sort((a, b) =>
        {
            return b.getComponent(Ball).nBallRunedActionIndex - a.getComponent(Ball).nBallRunedActionIndex;
        })

        let nActionScore = 0
        ballArr.forEach((ball, index) =>
        {
            let nodeScore = this.createAFloatScoreNode();
            nodeScore.active = true;
            // 根据连击数量分段进行加分，1-3连击0、4连击40分、5连击50分，依次类推
            if (this.nChainComboNum == 0 && this.nFrogBallComboNum > 3)
            {
                let score = this.nPerBallScore * this.nFrogBallComboNum;
                let nTypeNum = this.nFrogBallComboNum
                let strType = "连击"
                if(this.nThroughNum > 0)
                {
                    score = this.nPerBallScore * (this.nFrogBallComboNum + this.nThroughNum + 1)
                    nTypeNum = this.nFrogBallComboNum + this.nThroughNum + 1
                    strType = "连击+穿越"
                }
                nActionScore += score;
                nodeScore.getComponent(Float_Score).ShowFloatScore(score, strType, nTypeNum, () =>
                {
                    this.freeAScoreNode(nodeScore);
                })

            }
            // 普通加底分, 不算连击
            else if (this.nChainComboNum == 0 && this.nFrogBallComboNum <= 3)
            {
                let score = this.nPerBallScore;
                let nTypeNum = 0
                let strType = ""
                if(this.nThroughNum > 0)
                {
                    score = this.nPerBallScore * (this.nThroughNum + 1)
                    nTypeNum = this.nThroughNum + 1
                    strType = "穿越"
                }
                nActionScore += score;
                nodeScore.getComponent(Float_Score).ShowFloatScore(score, strType, nTypeNum, () =>
                {
                    this.freeAScoreNode(nodeScore);
                })
            }
            else if (this.nChainComboNum > 0)
            {
                let score = this.nPerBallScore * (this.nChainComboNum + 1);
                nActionScore += score;
                nodeScore.getComponent(Float_Score).ShowFloatScore(score, "连锁", (this.nChainComboNum + 1), () =>
                {
                    this.freeAScoreNode(nodeScore);
                })
            }
            nodeScore.position = cc.v3(ball.position.x, ball.position.y + 50);
            this.nodePathRoot.addChild(nodeScore, 99);

            cc.tween(ball)
                .to(0.1, {scale: 1.5})
                .parallel(
                    cc.tween(ball).to(0.1, {scale: 0.5}),
                    cc.tween(ball).to(0.1, {opacity: 0}),
                )
                .call(() =>
                {
                    this.freeABallNode(ball);
                })
                .start();
        });

        // cc.error("?????????????????????????++++" + nActionScore)
        this.nAllActionScore += nActionScore;
        this.runScoreLabelToScore(this.nAllActionScore+"");
        this.setTargetPercent();
        this.nThroughNum = 0;// 计算完成,清空穿越分数


        return new Promise(resolve =>
        {

            cc.tween(this).delay(0.2).call(() =>
            {
                resolve();
            }).start();
        })
    }

    // 将所有球的位置重置一下,防止位置错误
    fixAllListBallPosition()
    {
        if (!this.nodeBallHead)
        {
            return;
        }

        let nStartIndex = this.listLivingBallPool.indexOf(this.nodeBallHead);
        for (let i = nStartIndex; i < this.listLivingBallPool.length; i++)
        {
            let curBall = this.listLivingBallPool[i];
            if (curBall)
            {
                let nCollRadius = curBall.getComponent(Ball).nCollisionRadius;
                let nLastIndex = curBall.getComponent(Ball).getBallLastPosIndex();
                if (this.listLivingBallPool[i + 1])
                {
                    let lastBall = this.listLivingBallPool[i + 1];
                    lastBall.getComponent(Ball).resetBallPosIndex(nLastIndex);
                }
            }
        }
    }

    //从后往前重新设置球的位置
    fixAllListBallPositionReverse(nIndexStart: number, nOverIndex?: number)
    {
        if (!this.nodeBallHead)
        {
            return;
        }

        if (nOverIndex === undefined)
        {
            nOverIndex = this.listLivingBallPool.indexOf(this.nodeBallHead);
        }
        if (nIndexStart <= nOverIndex)
        {
            return;
        }
        for (let i = nIndexStart; i >= nOverIndex + 1; i--)
        {
            let curBall = this.listLivingBallPool[i];
            if (curBall)
            {
                let nLastIndex = curBall.getComponent(Ball).getBallNextPosIndex();
                if (this.listLivingBallPool[i - 1])
                {
                    let nextBall = this.listLivingBallPool[i - 1];
                    nextBall.getComponent(Ball).resetBallPosIndex(nLastIndex, true);
                }
            }
        }
    }


    //检测head球是不是和断掉的地方撞上了
    checkHeadBallAndBrokenPoint()
    {
        if (this.ballNearbyEnd && this.ballNearbyStart)
        {
            let nCollRadius = this.ballNearbyStart.getComponent(Ball).nCollisionRadius;
            let fDist = this.ballNearbyEnd.position.sub(this.ballNearbyStart.position).mag();
            // cc.log("??????????????????????????????????" + fDist)
            if (fDist <= nCollRadius)
            {
                // 是不是在往回退的时候撞的
                this.listLivingBallPool.forEach((ball, index) =>
                {
                    ball.getComponent(Ball).selfControlMoveBack(false);
                })


                //撞上后,需要将和撞击点相连的球设置位置, 不相连的不能设置
                let nCollStartIndex = this.listLivingBallPool.indexOf(this.ballNearbyEnd);
                let bOverIndex = nCollStartIndex - 1;//找出和撞击点相连的最后一个点
                while (this.listLivingBallPool[bOverIndex])
                {
                    let tempBall = this.listLivingBallPool[bOverIndex]
                    // 找到了,下一个断开点
                    if (this.arrBrokenList.indexOf(tempBall) >= 0)
                    {
                        bOverIndex = bOverIndex + 1;
                        break;
                    }
                    bOverIndex--;
                }
                bOverIndex = bOverIndex < 0 ? 0 : bOverIndex;
                this.fixAllListBallPositionReverse(nCollStartIndex + 1, bOverIndex);


                // 必须是这个球后退时撞上了,才能继续判断消除
                let nCollIndex = this.listLivingBallPool.indexOf(this.ballNearbyStart)
                this.ballNearbyEnd = null;
                this.ballNearbyStart = null;
                this.checkBallFade(nCollIndex, false);

                return;
            }
        }

        if (this.arrBrokenList.length > 0 && this.nodeBallHead)
        {
            //遍历一遍
            let nMinBrokenIndex = 999999;
            let nMinIndex = -1;
            this.arrBrokenList.forEach((ball, index) =>
            {
                if (ball.getComponent(Ball).nBallRunedActionIndex <= nMinBrokenIndex)
                {
                    nMinBrokenIndex = ball.getComponent(Ball).nBallRunedActionIndex;
                    nMinIndex = index;
                }
            })

            let nSecondMinIndex = -1;
            let fNear = 999999;
            let nTempIndex = 0;
            this.arrBrokenList.forEach((ball, index) =>
            {
                if (ball.getComponent(Ball).nBallRunedActionIndex != nMinBrokenIndex)
                {
                    let curOffset = ball.getComponent(Ball).nBallRunedActionIndex - nMinBrokenIndex;
                    if (fNear > curOffset)
                    {
                        nSecondMinIndex = index;
                        fNear = curOffset;
                        nTempIndex = ball.getComponent(Ball).nBallRunedActionIndex;
                    }
                }
            })


            let theLastBrokenBall = this.arrBrokenList[nMinIndex];
            let nCollRadius = this.nodeBallHead.getComponent(Ball).nCollisionRadius;
            let fDist = this.nodeBallHead.position.sub(theLastBrokenBall.position).mag();

            // cc.log("asdadaas========>"+fDist);

            // 距离足够小, 撞上了
            if (fDist <= nCollRadius)
            {
                if (this.arrBrokenList.length == 1)
                {
                    this.setHeadBall(this.listLivingBallPool[0]);
                    this.continueBallCreateAndRolling();
                }
                else
                {
                    let secondMinBall = this.arrBrokenList[nSecondMinIndex];
                    let scIndex = this.listLivingBallPool.indexOf(secondMinBall);
                    this.setHeadBall(this.listLivingBallPool[scIndex + 1]);
                    this.continueBallCreateAndRolling();
                }
                this.arrBrokenList.splice(nMinIndex, 1);


                let nCollIndex = this.listLivingBallPool.indexOf(theLastBrokenBall);
                this.fixAllListBallPositionReverse(nCollIndex + 1);
            }
        }
    }


    /**
     * 递归遍历断开链接的地方两侧断开能不能再形成三个以上的同色球
     1 校验两侧的颜色是不是相同, 2, 两侧颜色相同的情况下是不是数量有三个 3,让前一截回滚回来, 然后消除,然后再走一次这个判断
     * @param ballFront 两侧其中的靠近起点的
     * @param ballBack  两侧靠近终点的
     * @param nSearchLast  两侧其中的靠近起点的下标
     * @param nSearchNext  两侧其中的靠近终点的下标
     */
    checkBrokenBallType(ballFront: cc.Node, ballBack: cc.Node, nSearchLast, nSearchNext)
    {
        let ObjCheckType = {
            bCanRunBack: false,
            nSameNum: 0,
        }
        let ballTypeFront = ballFront.getComponent(Ball).ballType;
        let ballTypeBack = ballBack.getComponent(Ball).ballType;

        //这两个不相等,什么都不用检测了
        if (ballTypeFront != ballTypeBack)
        {
            ObjCheckType.bCanRunBack = false;
            ObjCheckType.nSameNum = 0;
            return ObjCheckType;
        }
        // 开始检测这两个连接的还有多少个相等的
        else
        {
            let nAllSameTypeBallNum = 2; //初始肯定有两个相等的

            let nSearchFront = nSearchLast + 1
            let ballFront: cc.Node = null; //下一次递归时,靠近起点的球
            while (this.listLivingBallPool[nSearchFront])
            {
                let nextFrontBall = this.listLivingBallPool[nSearchFront]
                if (nextFrontBall.getComponent(Ball).ballType == ballTypeFront)
                {
                    nAllSameTypeBallNum++;
                    nSearchFront++;
                }
                else
                {
                    ballFront = nextFrontBall;
                    break;
                }
            }

            let nSearchBack = nSearchNext - 1
            let ballBack: cc.Node = null; //下一次递归时,靠近起点的球
            while (this.listLivingBallPool[nSearchBack])
            {
                let nextBackBall = this.listLivingBallPool[nSearchBack]
                if (nextBackBall.getComponent(Ball).ballType == ballTypeFront)
                {
                    nAllSameTypeBallNum++;
                    nSearchBack--;
                }
                else
                {
                    ballBack = nextBackBall;
                    break;
                }
            }

            cc.log("找到前后一共===>" + nAllSameTypeBallNum);
            let bCanRunBack = (nAllSameTypeBallNum >= 2);
            //让靠近终点的那队链表往回走
            if (bCanRunBack)
            {
                for (let i = nSearchNext; i >= 0; i--)
                {
                    let ball = this.listLivingBallPool[i];
                    ball.getComponent(Ball).selfControlMoveBack(true);
                }
            }

            ObjCheckType.bCanRunBack = bCanRunBack;
            ObjCheckType.nSameNum = nAllSameTypeBallNum;
            return ObjCheckType;
        }
    }

    // 前面的球组后退撞到后面的球组,需要将球组根据惯性往回退一点, 必须是连续撞击才行
    runLivingListCollBackAction()
    {

    }


    resetLivingBallsIndex()
    {
        this.listLivingBallPool.forEach((ball, index) =>
        {
            ball.zIndex = index;
        })
    }

    //设置头部的球
    setHeadBall(ball: cc.Node)
    {
        this.nodeBallHead = ball;

        // if (ball)
        // {
        //     let nStartIndex = this.listLivingBallPool.indexOf(this.nodeBallHead);
        //     cc.error("设置了球组的头===>Num是=" + this.nodeBallHead.getComponent(Ball).nBallTokenNum
        //         , " 在图中的位置=" + nStartIndex, " 颜色是=" + this.nodeBallHead.getComponent(Ball).getBallTypeString());
        // }
    }

    safePushBrokenList(ball: cc.Node)
    {
        // 防止重复添加的
        if (this.arrBrokenList.indexOf(ball) == -1)
        {
            this.arrBrokenList.push(ball);
        }
        // this.getBrokenList();
    }


    // 让所有球暂时停住
    pauseBallCreateAndRolling()
    {
        // 不创建
        this.bUpdateCreateBallList = false;
        // 不滚动
        this.listLivingBallPool.forEach((ball, index) =>
        {
            ball.getComponent(Ball).bBallCanRunPath = false;
        })
    }

    //让球继续滚动和创建
    continueBallCreateAndRolling()
    {
        // 点了暂停按钮了
        if(this.bGamePauseByButton)
        {
            return;
        }

        let nStartIndex = 0;
        if (this.nodeBallHead)
        {
            nStartIndex = this.listLivingBallPool.indexOf(this.nodeBallHead);
        }

        if (nStartIndex <= 0)
        {
            // cc.error("这里的head下标是======>" + nStartIndex);
        }
        else
        {
            cc.log("这里的head下标是======>" + nStartIndex);
        }
        this.bUpdateCreateBallList = true;
        this.listLivingBallPool.forEach((ball, index) =>
        {
            if (index >= nStartIndex)
            {
                ball.getComponent(Ball).bBallCanRunPath = true;
            }
            else
            {
                ball.getComponent(Ball).bBallCanRunPath = false;
            }
        })
    }


    createABallNode(): cc.Node
    {
        let aBallNode: cc.Node = null;
        if (this.listFreeBallPool.length > 0)
        {
            aBallNode = this.listFreeBallPool.shift();
        }
        else
        {
            aBallNode = cc.instantiate(this.prefabBallNode);
        }

        if (aBallNode.parent)
        {
            aBallNode.removeFromParent();
        }
        // 重置属性
        aBallNode.stopAllActions();
        aBallNode.opacity = 255;
        aBallNode.scale = 1;
        this.listLivingBallPool.push(aBallNode);
        return aBallNode;
    }

    createABallByBallType(ballType: BallType)
    {
        let aBallNode = this.createABallNode();
        aBallNode.getComponent(Ball).initWithBallType(ballType)
        return aBallNode;
    }

    freeABallNode(ball: cc.Node)
    {
        ball.removeFromParent();
        ball.stopAllActions();
        ball.getComponent(Ball).setCanRolling(false);

        this.removeFromLiving(ball)
        this.listFreeBallPool.push(ball);
    }

    removeFromLiving(ball: cc.Node)
    {
        let indexLiving = this.listLivingBallPool.indexOf(ball);
        if (indexLiving > -1)
        {
            this.listLivingBallPool.splice(indexLiving, 1);
        }
    }

    createAFloatScoreNode(): cc.Node
    {
        let aScoreNode: cc.Node = null;
        if (this.listFreeScorePool.length > 0)
        {
            aScoreNode = this.listFreeScorePool.shift();
        }
        else
        {
            aScoreNode = cc.instantiate(this.prefabFloatScore);
        }

        if (aScoreNode.parent)
        {
            aScoreNode.removeFromParent();
        }
        // 重置属性
        aScoreNode.stopAllActions();
        aScoreNode.opacity = 255;
        aScoreNode.scale = 1;
        this.listLivingScorePool.push(aScoreNode);
        return aScoreNode;
    }

    freeAScoreNode(aScoreNode: cc.Node)
    {
        aScoreNode.removeFromParent();
        aScoreNode.stopAllActions();

        let indexLiving = this.listLivingScorePool.indexOf(aScoreNode);
        if (indexLiving > -1)
        {
            this.listLivingScorePool.splice(indexLiving, 1);
        }

        this.listFreeScorePool.push(aScoreNode);
    }

    BoomAllPoolNode()
    {
        this.listLivingBallPool.forEach((ball, index)=>
        {
            cc.tween(ball)
                .to(0.1, {scale: 1.5})
                .parallel(
                    cc.tween(ball).to(0.1, {scale: 0.5}),
                    cc.tween(ball).to(0.1, {opacity: 0}),
                )
                .start();
        })
    }

    destroyedAllPoolNode()
    {
        if (this.nodeFrogBall)
        {
            this.nodeFrogBall.stopAllActions();
            this.nodeFrogBall.removeFromParent();
            this.nodeFrogBall.destroy();
            this.nodeFrogBall = null;
        }

        this.listLivingBallPool.forEach((ball, index) =>
        {
            ball.removeFromParent();
            ball.destroy();
        });
        this.listFreeBallPool.forEach((ball, index) =>
        {
            ball.removeFromParent();
            ball.destroy();
        });

        this.listLivingScorePool.forEach((ball, index) =>
        {
            ball.removeFromParent();
            ball.destroy();
        });
        this.listFreeScorePool.forEach((ball, index) =>
        {
            ball.removeFromParent();
            ball.destroy();
        });

        this.listLivingBallPool = [];
        this.listFreeBallPool = [];
        this.listLivingScorePool = [];
        this.listFreeScorePool = [];
    }

    DeBugBallList()
    {
        let str = "";
        this.listLivingBallPool.forEach((ball, index) =>
        {
            str += ball.getComponent(Ball).getBallTypeString() + " ";
        })

        console.error("str==>" + str)
    }

    getBrokenList()
    {
        let str = "";
        this.arrBrokenList.forEach((ball, index) =>
        {
            let i = this.listLivingBallPool.indexOf(ball);
            str += "一个球===>" + ball.getComponent(Ball).getBallTypeString() + " 链表位置=>" + i + "    ";

        })
        console.error("str==>" + str);
    }



    startClockTime() {
        this.formatTime()
        this.schedule(this.timeCallback);
    }

    timeCallback(fDt)
    {
        this.nGameTime -= fDt

        this.formatTime()
        if (this.nGameTime <= 0)
        {
            this.unscheduleAllCallbacks()
            this.timeOver();
            return
        }
    }

    formatTime() {
        let minutes = Math.floor(this.nGameTime / 60)
        let seconds = Math.floor(this.nGameTime % 60)
        let fmtSec = "00"
        if (seconds < 10) {
            fmtSec = "0" + seconds
        } else {
            fmtSec = "" + seconds
        }
        this.labelTopTime.string = minutes + "/" + fmtSec
    }

    setTargetPercent()
    {
        let fPercent = Math.floor(this.nAllActionScore / this.nTargetActionScore * 100)
        fPercent = fPercent > 100 ? 100 : fPercent;
        this.labelTopScorePercent.string = fPercent+"/"

        //目标分达标了
        if(this.nAllActionScore >= this.nTargetActionScore)
        {
            this.gameComplete();
        }
    }


    // 滚动的数字条
    // 滚动的数字条
    // 滚动的数字条
    // 滚动的数字条
    // 滚动的数字条
    strFinalStr :string = "";
    nLoopCount:number = 0;
    nPerLoopAddNum:number = 0;
    // 让分数条滚动至指定分
    runScoreLabelToScore(strScore:string)
    {
        let strOldScore = this.labelTopScore.string;

        this.strFinalStr = strScore;
        this.nPerLoopAddNum = parseInt(String((parseInt(strScore) - parseInt(strOldScore)) / 8));
        this.nLoopCount = 0;
        this.unschedule(this.updateScoreLabel);
        this.schedule(this.updateScoreLabel, 0.05, 8);
    }

    updateScoreLabel()
    {
        if (this.nLoopCount == 8)
        {
            //确保最终显示的分数是对的
            this.labelTopScore.string = this.strFinalStr;
            this.unschedule(this.updateScoreLabel);
        }
        else
        {
            this.labelTopScore.string = "" + (parseInt(this.labelTopScore.string) + this.nPerLoopAddNum)
        }
        this.nLoopCount++;
    }
    //
    // // 返回nMin-nMax之间的随机整数 [min, max]
    getIntRandom(nMin, nMax): number
    {
        if (nMax <= nMin)
        {
            return nMax;
        }
        return Math.floor(Math.random() * (nMax - nMin + 1) + nMin)
    }


    onDestroy()
    {
        cc.log("==gamescene==destroy")
        GateMgr.isJoined = false
        this.offAllEvent()
        EventTrack.add(TrackNames.GAME_QUIT)
        // 开启多点,防止别的游戏需要
        cc.macro.ENABLE_MULTI_TOUCH = true;
        AudioUtil.stopBackground()
        this.destroyedAllPoolNode();
    }

}


// // 等aaabbb()全部运行完毕才能运行下一句

// let time1 = new Date().getTime();
// async function aaabbb ()
// {
//     let time2 = new Date().getTime();
//     console.log("11111=>" + (time2-time1));
//
//     return new Promise(resolve =>
//     {
//         let time3 = new Date().getTime();
//         console.log("2222=>" + (time3-time2));
//
//         setTimeout(() =>
//         {
//             let time4 = new Date().getTime();
//             console.log("3333=>" + (time4-time3));
//             resolve();
//         }, 2000)
//
//     })
// }
// await aaabbb();
// let time5 = new Date().getTime();
// console.log("44444=>" + (time5 - time1));